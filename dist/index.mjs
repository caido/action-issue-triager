import * as core from "@actions/core";
import * as github from "@actions/github";
import * as fs from "fs";
import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { createStep, createWorkflow } from "@mastra/core";
import z$1, { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { Octokit } from "octokit";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { PromptInjectionDetector } from "@mastra/core/processors";

//#region src/types.ts
const GithubIssueReference = z.object({
	owner: z.string(),
	repo: z.string(),
	number: z.number()
});
const GitHubLabelSchema = z.object({
	name: z.string(),
	description: z.string().nullish()
});
const GithubLabelAssignmentSchema = z.object({
	name: z.string(),
	reason: z.string()
});
const GitHubIssueSchema = z.object({
	reference: GithubIssueReference,
	title: z.string(),
	body: z.string().nullable(),
	labels: z.array(GitHubLabelSchema)
});

//#endregion
//#region src/mastra/tools/get-issue.ts
const getIssueTool = createTool({
	id: "get-issue",
	description: "Get GitHub issue data from a repository",
	inputSchema: z.object({ issueReference: GithubIssueReference }),
	outputSchema: z.object({ issue: GitHubIssueSchema }),
	execute: async ({ context: { issueReference } }) => {
		try {
			const { data: issue } = await new Octokit({ auth: process.env.GITHUB_TOKEN }).rest.issues.get({
				owner: issueReference.owner,
				repo: issueReference.repo,
				issue_number: issueReference.number
			});
			return { issue: {
				reference: issueReference,
				labels: issue.labels.map((label) => {
					if (typeof label === "string") return {
						name: label,
						description: null
					};
					return {
						name: label.name ?? "",
						description: label.description
					};
				}),
				title: issue.title,
				body: issue.body || null
			} };
		} catch (error) {
			console.error("Error fetching issue:", error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to fetch issue #${issueReference.number} from ${issueReference.owner}/${issueReference.repo}: ${errorMessage}`);
		}
	}
});

//#endregion
//#region src/mastra/tools/get-repository-labels.ts
const getRepositoryLabelsTool = createTool({
	id: "get-repository-labels",
	description: "Get all available labels from a GitHub repository",
	inputSchema: z.object({
		owner: z.string().describe("Repository owner (username or organization)"),
		repo: z.string().describe("Repository name")
	}),
	outputSchema: z.object({
		labels: z.array(z.object({
			name: z.string(),
			color: z.string(),
			description: z.string().nullable()
		})),
		totalCount: z.number()
	}),
	execute: async ({ context: { owner, repo } }) => {
		try {
			const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
			const { data: labels } = await octokit.rest.issues.listLabelsForRepo({
				owner,
				repo,
				per_page: 100
			});
			let allLabels = [...labels];
			let page = 2;
			while (labels.length === 100) {
				const { data: nextPageLabels } = await octokit.rest.issues.listLabelsForRepo({
					owner,
					repo,
					per_page: 100,
					page
				});
				if (nextPageLabels.length === 0) break;
				allLabels = [...allLabels, ...nextPageLabels];
				page++;
			}
			return {
				labels: allLabels.map((label) => ({
					name: label.name,
					color: label.color,
					description: label.description
				})),
				totalCount: allLabels.length
			};
		} catch (error) {
			console.error("Error fetching repository labels:", error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to fetch labels from ${owner}/${repo}: ${errorMessage}`);
		}
	}
});

//#endregion
//#region src/mastra/tools/add-labels.ts
const addLabelsTool = createTool({
	id: "add-labels",
	description: "Add labels to a GitHub issue",
	inputSchema: z.object({
		issueReference: GithubIssueReference,
		labels: z.array(GithubLabelAssignmentSchema).describe("Array of label to add")
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string()
	}),
	execute: async ({ context: { issueReference, labels } }) => {
		try {
			const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
			const labelNames = labels.map((label) => label.name);
			const { data: issue } = await octokit.rest.issues.addLabels({
				owner: issueReference.owner,
				repo: issueReference.repo,
				issue_number: issueReference.number,
				labels: labelNames
			});
			return {
				success: true,
				message: `Successfully added labels: ${labels.join(", ")} to issue #${issueReference.number}`
			};
		} catch (error) {
			console.error("Error adding labels:", error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				message: `Failed to add labels to issue #${issueReference.number}: ${errorMessage}`
			};
		}
	}
});

//#endregion
//#region src/mastra/agents/triager.prompt.ts
/**
* Builds a comprehensive prompt for the issue triager agent
* @param issue - The GitHub issue data
* @param availableLabels - Array of available repository labels
* @returns Formatted prompt string
*/
function buildTriagePrompt(issue, availableLabels) {
	const labelsList = availableLabels.map((label) => `- ${label.name}${label.description ? `: ${label.description}` : ""}`).join("\n");
	return `
Recommended labels to add to the issue (choose from the available labels in the repository)

**Issue Details:**
- Repository: ${issue.reference.owner}/${issue.reference.repo}
- Issue #${issue.reference.number}: ${issue.title}
- Current Labels: ${issue.labels.map((l) => l.name).join(", ") || "None"}

**Issue Description:**
${issue.body || "No description provided"}

**Available Labels in Repository:**
${labelsList}

`;
}

//#endregion
//#region src/mastra/agents/triager.ts
/**
* Creates a triager agent with the specified prompt
* @param options.systemPrompt - The system prompt to use for the agent
* @returns A configured Agent instance
*/
const createTriagerAgent = (options) => {
	const { systemPrompt } = options;
	return new Agent({
		name: "GitHub Issue Triager Agent",
		instructions: systemPrompt,
		model: openai("gpt-5-nano"),
		tools: {},
		inputProcessors: [new PromptInjectionDetector({ model: openai("gpt-5-nano") })]
	});
};

//#endregion
//#region src/mastra/workflows/triage-issue.ts
const fetchIssue = createStep(getIssueTool);
const getAllLabels = createStep(getRepositoryLabelsTool);
createStep(addLabelsTool);
const triage = createStep({
	id: "triage",
	inputSchema: z$1.object({
		issue: GitHubIssueSchema,
		labels: z$1.array(GitHubLabelSchema)
	}),
	outputSchema: z$1.object({ labels: z$1.array(GithubLabelAssignmentSchema) }),
	execute: async ({ inputData: { issue, labels } }) => {
		const prompt = buildTriagePrompt(issue, labels);
		return { labels: (await createTriagerAgent({ systemPrompt: prompt }).generate([{
			role: "user",
			content: prompt
		}], { output: z$1.object({ labels: z$1.array(GithubLabelAssignmentSchema) }) })).object.labels };
	}
});
const createTriageIssueWorkflow = (options) => {
	return createWorkflow({
		id: "issue-triager-workflow",
		description: "A workflow that triages issues",
		inputSchema: z$1.object({ issueReference: GithubIssueReference }),
		outputSchema: z$1.object({ labels: z$1.array(GithubLabelAssignmentSchema) })
	}).then(fetchIssue).map(async ({ getInitData }) => {
		const initData = getInitData();
		return {
			owner: initData.issueReference.owner,
			repo: initData.issueReference.repo
		};
	}).then(getAllLabels).map(async ({ getStepResult }) => {
		const issueResult = getStepResult(fetchIssue);
		const labelsResult = getStepResult(getAllLabels);
		return {
			issue: issueResult.issue,
			labels: labelsResult.labels
		};
	}).then(triage).map(async ({ getInitData, getStepResult }) => {
		const { issueReference } = getInitData();
		const { labels } = getStepResult(triage);
		return {
			issueReference,
			labels
		};
	}).commit();
};

//#endregion
//#region src/main.ts
async function run() {
	try {
		const openaiKey = core.getInput("openai-key", { required: true });
		const systemPromptFile = core.getInput("system-prompt-file", { required: true });
		const issueNumber = core.getInput("issue-number");
		process.env.OPENAI_API_KEY = openaiKey;
		if (!fs.existsSync(systemPromptFile)) throw new Error(`System prompt file not found: ${systemPromptFile}`);
		const systemPrompt = fs.readFileSync(systemPromptFile, "utf8");
		const triagerAgent = createTriagerAgent({ systemPrompt });
		const issueTriagerWorkflow = createTriageIssueWorkflow({ triagerAgent });
		const mastra = new Mastra({
			workflows: { issueTriagerWorkflow },
			storage: new LibSQLStore({ url: ":memory:" }),
			logger: new PinoLogger({
				name: "Mastra",
				level: "info"
			})
		});
		const issueReference = {
			owner: github.context.repo.owner,
			repo: github.context.repo.repo,
			number: parseInt(issueNumber, 10)
		};
		core.info(`Triaging issue #${issueReference.number} in ${issueReference.owner}/${issueReference.repo}`);
		const result = await (await mastra.getWorkflow("issueTriagerWorkflow").createRunAsync()).start({ inputData: { issueReference } });
		if (result.status === "success") {
			core.setOutput("labels", JSON.stringify(result.result.labels));
			core.setOutput("issue-number", issueReference.number);
			core.setOutput("repository", `${issueReference.owner}/${issueReference.repo}`);
			core.info(`Successfully triaged issue #${issueReference.number}`);
			core.info(`Recommended labels: ${result.result.labels.map((l) => l.name).join(", ")}`);
		} else if (result.status === "failed") throw new Error(`Workflow failed: ${result.error || "Unknown error"}`);
		else if (result.status === "suspended") throw new Error("Workflow was suspended unexpectedly");
		else throw new Error(`Unexpected workflow status: ${result.status}`);
	} catch (error) {
		if (error instanceof Error) core.setFailed(error.message);
		else core.setFailed("An unknown error occurred");
	}
}
run();

//#endregion
//#region src/index.ts
run();

//#endregion
export {  };
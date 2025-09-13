import { createStep, createWorkflow } from "@mastra/core";
import { triagerAgent, buildTriagePrompt } from "../agents/triager";
import { GithubIssueReference, GitHubIssueSchema, GitHubLabelSchema } from "../../types";
import z from "zod";
import { getIssueTool } from "../tools/get-issue";
import { getRepositoryLabelsTool } from "../tools/get-repository-labels";
import { addLabelsTool } from "../tools/add-labels";

const fetchIssue = createStep(getIssueTool);
const getAllLabels = createStep(getRepositoryLabelsTool);
const triage = createStep({
    id: "triage",
    inputSchema: z.object({
        issue: GitHubIssueSchema,
        labels: z.array(GitHubLabelSchema),
    }),
    outputSchema: z.object({
        labels: z.array(GitHubLabelSchema),
    }),
    execute: async ({inputData: { issue, labels } }) => {
        const prompt = buildTriagePrompt(issue, labels);
        const result = await triagerAgent.generate([{
            role: "user",
            content: prompt,
        }], {
            output: z.object({
                labels: z.array(GitHubLabelSchema),
            }),
        });

        return {
            labels: result.object.labels,
        };
    },
});

export const issueTriagerWorkflow = createWorkflow({
    id: "issue-triager-workflow",
    description: "A workflow that triages issues",
    inputSchema: z.object({
        issueReference: GithubIssueReference,
    }),
    outputSchema: z.object({
        labels: z.array(GitHubLabelSchema),
    }),
})
    .then(fetchIssue)
    .map(async ({ getInitData }) => {
        const initData = getInitData();
        return {
            owner: initData.owner,
            repo: initData.repo,
        };
    })
    .then(getAllLabels)
    .map(async ({ getStepResult }) => {
        const issueResult = getStepResult(fetchIssue);
        const labelsResult = getStepResult(getAllLabels);

        return {
            issue: issueResult.issue,
            labels: labelsResult.labels,
        };
    })
    .then(triage)
    .map(async ({ getInitData, getStepResult }) => {
        const initData = getInitData();
        const triageResult = getStepResult(triage);
        return {
            issueReference: initData.issueReference,
            labels: triageResult.labels,
        };
    })
    .commit();
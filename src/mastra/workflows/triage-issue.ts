import { createStep, createWorkflow } from "@mastra/core";
import { GithubIssueReference, GitHubIssueSchema, GithubLabelAssignmentSchema, GitHubLabelSchema } from "../../types";
import z from "zod";
import { getIssueTool } from "../tools/get-issue";
import { getRepositoryLabelsTool } from "../tools/get-repository-labels";
import { addLabelsTool } from "../tools/add-labels";

const fetchIssue = createStep(getIssueTool);
const getAllLabels = createStep(getRepositoryLabelsTool);
const addLabels = createStep(addLabelsTool);
const triage = createStep({
    id: "triage",
    inputSchema: z.object({
        issue: GitHubIssueSchema,
        labels: z.array(GitHubLabelSchema),
    }),
    outputSchema: z.object({
        labels: z.array(GithubLabelAssignmentSchema),
    }),
    execute: async ({inputData: { issue, labels } }) => {
        console.log(issue, labels);
        const prompt = buildTriagePrompt(issue, labels);
        const result = await triagerAgent.generate([{
            role: "user",
            content: prompt,
        }], {
            output: z.object({
                labels: z.array(GithubLabelAssignmentSchema),
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
        labels: z.array(GithubLabelAssignmentSchema),
    }),
})
    .then(fetchIssue)
    .map(async ({ getInitData }) => {
        const initData = getInitData() as { issueReference: GithubIssueReference };
        return {
            owner: initData.issueReference.owner,
            repo: initData.issueReference.repo,
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
        const { issueReference } = getInitData() as { issueReference: GithubIssueReference };
        const { labels } = getStepResult(triage);
        return {
            issueReference,
            labels,
        };
    })
    //.then(addLabels)
    .commit();
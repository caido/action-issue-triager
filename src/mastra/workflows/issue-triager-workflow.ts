import { createStep, createWorkflow } from "@mastra/core";
import { getIssueTool, getRepositoryLabelsTool } from "../tools/github-tools";
import z from "zod";
import { issueTriagerAgent } from "../agents/issue-triager-agent";

const fetchIssue = createStep(getIssueTool);
const getAllLabels = createStep(getRepositoryLabelsTool);
const analyze = createStep(issueTriagerAgent);

export const issueTriagerWorkflow = createWorkflow({
    id: "issue-triager-workflow",
    description: "A workflow that triages issues",
    inputSchema: z.object({
        owner: z.string(),
        repo: z.string(),
        issueNumber: z.number(),
    }),
    outputSchema: z.object({
        issue: z.object({
            owner: z.string(),
            repo: z.string(),
            number: z.number(),
            labels: z.array(z.string()),
        }),
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
    .then(analyze)
    .commit();
import { type Agent, createStep, createWorkflow } from "@mastra/core";
import z from "zod";

import {
  GithubIssueReference,
  GitHubIssueSchema,
  GithubLabelAssignmentSchema,
  GitHubLabelSchema,
} from "../../types";
import { createTriagerAgent } from "../agents/triager";
import { buildTriagePrompt } from "../agents/triager.prompt";
import { addLabelsTool } from "../tools/add-labels";
import { getIssueTool } from "../tools/get-issue";
import { getRepositoryLabelsTool } from "../tools/get-repository-labels";

type CreateTriageIssueWorkflowParams = {
  triagerAgent: Agent;
};

export const createTriageIssueWorkflow = (
  options: CreateTriageIssueWorkflowParams,
) => {
  const fetchIssue = createStep(getIssueTool);
  const getAllLabels = createStep(getRepositoryLabelsTool);
  const addLabels = createStep(addLabelsTool);
  const triage = createStep({
    id: "triage",
    inputSchema: z.object({
      issue: GitHubIssueSchema,
      labels: z.array(GitHubLabelSchema),
      dryRun: z.boolean().optional(),
    }),
    outputSchema: z.object({
      labels: z.array(GithubLabelAssignmentSchema),
    }),
    execute: async ({ inputData: { issue, labels }, mastra }) => {
      const logger = mastra.getLogger();
      const prompt = buildTriagePrompt(issue, labels);
      logger.info("Built triage prompt: %s", prompt);

      const result = await options.triagerAgent.generate(
        [
          {
            role: "user",
            content: prompt,
          },
        ],
        {
          output: z.object({
            labels: z.array(GithubLabelAssignmentSchema),
          }),
        },
      );

      return {
        labels: result.object.labels,
      };
    },
  });

  return createWorkflow({
    id: "issue-triager-workflow",
    description: "A workflow that triages issues",
    inputSchema: z.object({
      issueReference: GithubIssueReference,
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      labels: z.array(GithubLabelAssignmentSchema),
    }),
  })
    .then(fetchIssue)
    .map(async ({ getInitData }) => {
      const initData = getInitData() as {
        issueReference: GithubIssueReference;
      };
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
      const { issueReference } = getInitData() as {
        issueReference: GithubIssueReference;
      };
      const { labels } = getStepResult(triage);
      return {
        issueReference,
        labels,
      };
    })
    .then(addLabels)
    .map(async ({ getStepResult }) => {
      const { labels } = getStepResult(triage);
      const { success, message } = getStepResult(addLabels);
      return {
        labels,
        success,
        message,
      };
    })
    .commit();
};

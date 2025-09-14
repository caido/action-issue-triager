import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Octokit } from "octokit";
import { GithubIssueReference, GitHubLabel, GithubLabelAssignmentSchema, GitHubLabelSchema } from "../../types";

export const addLabelsTool = createTool({
  id: "add-labels",
  description: "Add labels to a GitHub issue",
  inputSchema: z.object({
    issueReference: GithubIssueReference,
    labels: z.array(GithubLabelAssignmentSchema).describe("Array of label to add"),
  }),
  outputSchema: z.object({
    labels: z.array(GithubLabelAssignmentSchema),
  }),
  execute: async ({ context: { issueReference, labels } }) => {
    try {
      // Initialize Octokit with GitHub token from environment
      const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
      });

      // Add labels to the issue
      const labelNames = labels.map((label) => label.name);
      const { data: issue } = await octokit.rest.issues.addLabels({
        owner: issueReference.owner,
        repo: issueReference.repo,
        issue_number: issueReference.number,
        labels: labelNames,
      });

      return {
        labels,
      };
    } catch (error) {
      console.error("Error adding labels:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        labels,
      };
    }
  },
});

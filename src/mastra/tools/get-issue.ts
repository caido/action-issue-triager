import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Octokit } from "octokit";
import { GitHubIssue, GithubIssueReference, GitHubIssueSchema } from "../../types";

export const getIssueTool = createTool({
  id: "get-issue",
  description: "Get GitHub issue data from a repository",
  inputSchema: z.object({
    issueReference: GithubIssueReference,
  }),
  outputSchema: z.object({
    issue: GitHubIssueSchema,
  }),
  execute: async ({ context: { issueReference } }) => {
    try {
      // Initialize Octokit with GitHub token from environment
      const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
      });

      // Fetch the issue from GitHub API
      const { data: issue } = await octokit.rest.issues.get({
        owner: issueReference.owner,
        repo: issueReference.repo,
        issue_number: issueReference.number,
      });

      const issueData: GitHubIssue = {
        reference: issueReference,
        labels: issue.labels.map((label) => {
          if (typeof label === "string") {
            return {
              name: label,
              description: null,
            };
          }

          return {
            name: label.name ?? "",
            description: label.description,
          };

        }),
        title: issue.title,
        body: issue.body || null,
      };

      return {
        issue: issueData,
      };
    } catch (error) {
      console.error("Error fetching issue:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch issue #${issueReference.number} from ${issueReference.owner}/${issueReference.repo}: ${errorMessage}`);
    }
  },
});

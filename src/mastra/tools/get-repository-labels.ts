import { createTool } from "@mastra/core/tools";
import { Octokit } from "octokit";
import { z } from "zod";

import { GitHubLabelSchema } from "../../types";

export const getRepositoryLabelsTool = createTool({
  id: "get-repository-labels",
  description: "Get all available labels from a GitHub repository",
  inputSchema: z.object({
    owner: z.string().describe("Repository owner (username or organization)"),
    repo: z.string().describe("Repository name"),
  }),
  outputSchema: z.object({
    labels: z.array(GitHubLabelSchema),
    totalCount: z.number(),
  }),
  execute: async ({ context: { owner, repo } }) => {
    try {
      // Initialize Octokit with GitHub token from environment
      const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
      });

      // Fetch all labels from the repository
      const { data: labels } = await octokit.rest.issues.listLabelsForRepo({
        owner,
        repo,
        per_page: 100, // Maximum per page
      });

      // If there are more than 100 labels, we need to paginate
      let allLabels = [...labels];
      let page = 2;

      while (labels.length === 100) {
        const { data: nextPageLabels } =
          await octokit.rest.issues.listLabelsForRepo({
            owner,
            repo,
            per_page: 100,
            page,
          });

        if (nextPageLabels.length === 0) break;

        allLabels = [...allLabels, ...nextPageLabels];
        page++;
      }

      return {
        labels: allLabels.map((label) => ({
          name: label.name,
          description: label.description ?? "",
        })),
        totalCount: allLabels.length,
      };
    } catch (error) {
      console.error("Error fetching repository labels:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to fetch labels from ${owner}/${repo}: ${errorMessage}`,
      );
    }
  },
});

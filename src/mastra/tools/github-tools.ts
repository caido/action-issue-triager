import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const getIssueTool = createTool({
  id: "get-issue",
  description: "Get GitHub issue data from a repository",
  inputSchema: z.object({
    owner: z.string().describe("Repository owner (username or organization)"),
    repo: z.string().describe("Repository name"),
    issueNumber: z.number().describe("Issue number to fetch"),
  }),
  outputSchema: z.object({
    issue: z.object({
      number: z.number(),
      title: z.string(),
      body: z.string().nullable(),
      state: z.string(),
      labels: z.array(z.object({
        name: z.string(),
        color: z.string(),
      })),
      assignees: z.array(z.object({
        login: z.string(),
      })),
      created_at: z.string(),
      updated_at: z.string(),
    }),
  }),
  execute: async ({ context: { owner, repo, issueNumber } }) => {
    return await getIssue(owner, repo, issueNumber);
  },
});

export const addLabelsTool = createTool({
  id: "add-labels",
  description: "Add labels to a GitHub issue",
  inputSchema: z.object({
    owner: z.string().describe("Repository owner (username or organization)"),
    repo: z.string().describe("Repository name"),
    issueNumber: z.number().describe("Issue number"),
    labels: z.array(z.string()).describe("Array of label names to add"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context: { owner, repo, issueNumber, labels } }) => {
    return await addLabels(owner, repo, issueNumber, labels);
  },
});

const getIssue = async (owner: string, repo: string, issueNumber: number) => {
  // For now, we'll return mock data since we don't have GitHub API credentials set up
  // In a real implementation, you would use the GitHub API with proper authentication
  const mockIssue = {
    number: issueNumber,
    title: "Sample Issue: Login button not working on mobile",
    body: "Users report that clicking the login button on mobile Safari doesn't respond. This affects iOS 15+ users.",
    state: "open",
    labels: [
      { name: "bug", color: "d73a4a" },
      { name: "mobile", color: "7057ff" },
    ],
    assignees: [],
    created_at: "2024-01-15T10:30:00Z",
    updated_at: "2024-01-15T10:30:00Z",
  };

  return {
    issue: mockIssue,
  };
};

const addLabels = async (owner: string, repo: string, issueNumber: number, labels: string[]) => {
  // For now, we'll return a success response
  // In a real implementation, you would make a PATCH request to the GitHub API
  console.log(`Would add labels ${labels.join(", ")} to issue #${issueNumber} in ${owner}/${repo}`);
  
  return {
    success: true,
    message: `Successfully added labels: ${labels.join(", ")}`,
  };
};

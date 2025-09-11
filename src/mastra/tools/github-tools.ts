import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Octokit } from "octokit";

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

export const assignToProjectTool = createTool({
  id: "assign-to-project",
  description: "Assign a GitHub issue to a ProjectV2",
  inputSchema: z.object({
    owner: z.string().describe("Repository owner (username or organization)"),
    repo: z.string().describe("Repository name"),
    issueNumber: z.number().describe("Issue number"),
    projectId: z.string().describe("ProjectV2 ID"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context: { owner, repo, issueNumber, projectId } }) => {
    return await assignToProject(owner, repo, issueNumber, projectId);
  },
});

export const getRepositoryLabelsTool = createTool({
  id: "get-repository-labels",
  description: "Get all available labels from a GitHub repository",
  inputSchema: z.object({
    owner: z.string().describe("Repository owner (username or organization)"),
    repo: z.string().describe("Repository name"),
  }),
  outputSchema: z.object({
    labels: z.array(z.object({
      name: z.string(),
      color: z.string(),
      description: z.string().nullable(),
    })),
    totalCount: z.number(),
  }),
  execute: async ({ context: { owner, repo } }) => {
    return await getRepositoryLabels(owner, repo);
  },
});

const getIssue = async (owner: string, repo: string, issueNumber: number) => {
  try {
    // Initialize Octokit with GitHub token from environment
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    // Fetch the issue from GitHub API
    const { data: issue } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    return {
      issue: {
        number: issue.number,
        title: issue.title,
        body: issue.body || null,
        state: issue.state,
        labels: issue.labels.map((label: any) => ({
          name: label.name,
          color: label.color,
        })),
        assignees: issue.assignees?.map((assignee: any) => ({
          login: assignee.login,
        })) || [],
        created_at: issue.created_at,
        updated_at: issue.updated_at,
      },
    };
  } catch (error) {
    console.error("Error fetching issue:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch issue #${issueNumber} from ${owner}/${repo}: ${errorMessage}`);
  }
};

const addLabels = async (owner: string, repo: string, issueNumber: number, labels: string[]) => {
  try {
    // Initialize Octokit with GitHub token from environment
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    // Add labels to the issue
    const { data: issue } = await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels,
    });

    return {
      success: true,
      message: `Successfully added labels: ${labels.join(", ")} to issue #${issueNumber}`,
    };
  } catch (error) {
    console.error("Error adding labels:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to add labels to issue #${issueNumber}: ${errorMessage}`,
    };
  }
};

const assignToProject = async (owner: string, repo: string, issueNumber: number, projectId: string) => {
  try {
    // Initialize Octokit with GitHub token from environment
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    // First, get the issue to get its node ID
    const { data: issue } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    // Add the issue to the project using GraphQL API
    const mutation = `
      mutation AddProjectV2ItemById($input: AddProjectV2ItemByIdInput!) {
        addProjectV2ItemById(input: $input) {
          item {
            id
          }
        }
      }
    `;

    const variables = {
      input: {
        projectId: projectId,
        contentId: issue.node_id,
      },
    };

    const response = await octokit.graphql(mutation, variables);

    return {
      success: true,
      message: `Successfully assigned issue #${issueNumber} to project ${projectId}`,
    };
  } catch (error) {
    console.error("Error assigning to project:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to assign issue #${issueNumber} to project: ${errorMessage}`,
    };
  }
};

const getRepositoryLabels = async (owner: string, repo: string) => {
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
      const { data: nextPageLabels } = await octokit.rest.issues.listLabelsForRepo({
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
      labels: allLabels.map((label: any) => ({
        name: label.name,
        color: label.color,
        description: label.description,
      })),
      totalCount: allLabels.length,
    };
  } catch (error) {
    console.error("Error fetching repository labels:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch labels from ${owner}/${repo}: ${errorMessage}`);
  }
};

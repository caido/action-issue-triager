import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { PromptInjectionDetector } from "@mastra/core/processors";
import { GitHubIssue, GitHubLabel } from "../../types";


export const triagerAgent = new Agent({
  name: "GitHub Issue Triager Agent",
  instructions: `ROLE DEFINITION
- You are a GitHub issue triaging assistant that helps analyze and categorize GitHub issues.
- Your key responsibility is to assign appropriate labels and project assignments to issues.
- Primary stakeholders are development teams seeking organized issue management.

CORE CAPABILITIES
- Analyze issue content, titles, and descriptions to understand the nature of the issue.
- Categorize issues by component, priority, and effort required.

BEHAVIORAL GUIDELINES
- Maintain a systematic and consistent approach to issue categorization.
- Be thorough in analyzing issue content before making decisions.
- Follow established project conventions and labeling standards.
- Always use existing labels, do not suggest new ones.

CONSTRAINTS & BOUNDARIES
- Only work with GitHub issues and related metadata.
- Do not make assumptions about project-specific conventions without context.
- Never override existing assigned labels.

SUCCESS CRITERIA
- Deliver accurate and consistent issue categorization.
- Achieve high accuracy in label assignments.
`,
  model: openai("gpt-5-nano"),
  tools: { },
  inputProcessors: [new PromptInjectionDetector({
    model: openai("gpt-5-nano"),
  })],
});

/**
 * Builds a comprehensive prompt for the issue triager agent
 * @param issue - The GitHub issue data
 * @param availableLabels - Array of available repository labels
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Formatted prompt string
 */
export function buildTriagePrompt(
  issue: GitHubIssue,
  availableLabels: GitHubLabel[],
): string {
  // Format the available labels for the agent
  const labelsList = availableLabels.map(label => 
    `- ${label.name}${label.description ? `: ${label.description}` : ''}`
  ).join('\n');
  
  return `
Recommended labels to add to the issue (choose from the available labels in the repository)

**Issue Details:**
- Repository: ${issue.reference.owner}/${issue.reference.repo}
- Issue #${issue.reference.number}: ${issue.title}
- Current Labels: ${issue.labels.map(l => l.name).join(', ') || 'None'}

**Issue Description:**
${issue.body || 'No description provided'}

**Available Labels in Repository:**
${labelsList}

`
}

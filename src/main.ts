import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { createTriageIssueWorkflow } from './mastra/workflows/triage-issue';
import { createTriagerAgent } from './mastra/agents/triager';
import { GithubIssueReference } from './types';
import path from 'path';

export async function run(): Promise<void> {
  try {
    // Get inputs
    const openaiKey = core.getInput('openai-key', { required: true });
    const systemPromptFile = core.getInput('system-prompt-file', { required: true });
    const issueNumber = core.getInput('issue-number');

    // Set OpenAI API key
    process.env.OPENAI_API_KEY = openaiKey;

    // Validate system prompt file exists
    const systemPromptFilePath = path.join(process.env.GITHUB_WORKSPACE!, systemPromptFile);
    if (!fs.existsSync(systemPromptFilePath)) {
      throw new Error(`System prompt file not found: ${systemPromptFile}`);
    }

    // Read system prompt
    const systemPrompt = fs.readFileSync(systemPromptFilePath, 'utf8');
    
    // Initialize Mastra
    const triagerAgent = createTriagerAgent({ systemPrompt });
    const issueTriagerWorkflow = createTriageIssueWorkflow({ triagerAgent });
    const mastra = new Mastra({
      workflows: { issueTriagerWorkflow },
      logger: new PinoLogger({
        name: 'Mastra',
        level: 'info',
      }),
    });

    // Use current issue from context
    const issueReference: GithubIssueReference = {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        number: parseInt(issueNumber, 10)
    };

    core.info(`Triaging issue #${issueReference.number} in ${issueReference.owner}/${issueReference.repo}`);

    // Execute the workflow
    const workflow = mastra.getWorkflow("issueTriagerWorkflow");
    const workflowRun = await workflow.createRunAsync();
    const result = await workflowRun.start({
      inputData: {
        issueReference
      }
    });

    // Check workflow result status
    if (result.status === 'success') {
      // Set outputs
      core.setOutput('labels', JSON.stringify(result.result.labels));
      core.setOutput('issue-number', issueReference.number);
      core.setOutput('repository', `${issueReference.owner}/${issueReference.repo}`);

      // Log results
      core.info(`Successfully triaged issue #${issueReference.number}`);
      core.info(`Recommended labels: ${result.result.labels.map(l => l.name).join(', ')}`);
    } else if (result.status === 'failed') {
      throw new Error(`Workflow failed: ${result.error || 'Unknown error'}`);
    } else if (result.status === 'suspended') {
      throw new Error('Workflow was suspended unexpectedly');
    } else {
      throw new Error(`Unexpected workflow status: ${(result as any).status}`);
    }

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

// Run the action
run();

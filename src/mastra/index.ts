
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { createTriageIssueWorkflow } from './workflows/triage-issue';
import { createTriagerAgent } from './agents/triager';
import { defaultSystemPrompt } from './agents/triager.prompt';

const issueTriagerAgent = createTriagerAgent({ systemPrompt: defaultSystemPrompt() });
const issueTriagerWorkflow = createTriageIssueWorkflow({ triagerAgent: issueTriagerAgent });

export const mastra = new Mastra({
  workflows: { issueTriagerWorkflow },
  agents: { issueTriagerAgent },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
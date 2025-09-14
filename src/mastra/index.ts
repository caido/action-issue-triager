
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { createTriageIssueWorkflow } from './workflows/triage-issue';
import { createTriagerAgent } from './agents/triager';
import { defaultSystemPrompt } from './agents/triager.prompt';

const issueTriagerAgent = createTriagerAgent({ systemPrompt: defaultSystemPrompt() });
const issueTriagerWorkflow = createTriageIssueWorkflow({ triagerAgent: issueTriagerAgent });

export const mastra = new Mastra({
  workflows: { issueTriagerWorkflow },
  agents: { issueTriagerAgent },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
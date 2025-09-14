
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { issueTriagerWorkflow } from './workflows/triage-issue';
import { createTriagerAgent } from './agents/triager';
import { buildSystemPrompt } from './agents/triager.prompt';

export const mastra = new Mastra({
  workflows: { issueTriagerWorkflow },
  agents: { issueTriagerAgent: createTriagerAgent({ prompt: buildSystemPrompt() }) },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});

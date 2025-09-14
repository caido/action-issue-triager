import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { PromptInjectionDetector } from "@mastra/core/processors";

type CreateTriagerAgentParams = {
  systemPrompt: string;
};

/**
 * Creates a triager agent with the specified prompt
 * @param options.systemPrompt - The system prompt to use for the agent
 * @returns A configured Agent instance
 */
export const createTriagerAgent = (options: CreateTriagerAgentParams) => {
  const { systemPrompt } = options;
  return new Agent({
    name: "GitHub Issue Triager Agent",
    instructions: systemPrompt,
    model: openai("gpt-5-nano"),
    tools: {},
    inputProcessors: [
      new PromptInjectionDetector({
        model: openai("gpt-5-nano"),
      }),
    ],
  });
};

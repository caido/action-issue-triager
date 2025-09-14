import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { PromptInjectionDetector } from "@mastra/core/processors";

/**
 * Creates a triager agent with the specified prompt
 * @param prompt - The system prompt to use for the agent
 * @returns A configured Agent instance
 */
export function createTriagerAgent({ prompt }: { prompt: string }): Agent {
  return new Agent({
    name: "GitHub Issue Triager Agent",
    instructions: prompt,
    model: openai("gpt-5-nano"),
    tools: { },
    inputProcessors: [new PromptInjectionDetector({
      model: openai("gpt-5-nano"),
    })],
  });
}
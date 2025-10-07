import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { OutputSchema } from '../stream';
import type { Agent } from './agent';
import type { AgentExecutionOptions } from './agent.types';
import type { MessageListInput } from './message-list';

export async function tryGenerateWithJsonFallback<
  OUTPUT extends OutputSchema = undefined,
  FORMAT extends 'aisdk' | 'mastra' = 'mastra',
>(agent: Agent, prompt: MessageListInput, options: AgentExecutionOptions<OUTPUT, FORMAT>) {
  if (!options.structuredOutput?.schema) {
    throw new MastraError({
      id: 'STRUCTURED_OUTPUT_OPTIONS_REQUIRED',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: 'structuredOutput is required to use tryGenerateWithJsonFallback',
    });
  }

  try {
    return await agent.generate(prompt, options);
  } catch (error) {
    console.warn('Error in tryGenerateWithJsonFallback. Attempting fallback.', error);
    return await agent.generate(prompt, {
      ...options,
      structuredOutput: { ...options.structuredOutput, jsonPromptInjection: true },
    });
  }
}

export async function tryStreamWithJsonFallback<
  OUTPUT extends OutputSchema = undefined,
  FORMAT extends 'aisdk' | 'mastra' = 'mastra',
>(agent: Agent, prompt: MessageListInput, options: AgentExecutionOptions<OUTPUT, FORMAT>) {
  if (!options.structuredOutput?.schema) {
    throw new MastraError({
      id: 'STRUCTURED_OUTPUT_OPTIONS_REQUIRED',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: 'structuredOutput is required to use tryStreamWithJsonFallback',
    });
  }

  try {
    return await agent.stream(prompt, options);
  } catch (error) {
    console.warn('Error in tryStreamWithJsonFallback. Attempting fallback.', error);
    return await agent.stream(prompt, {
      ...options,
      structuredOutput: { ...options.structuredOutput, jsonPromptInjection: true },
    });
  }
}

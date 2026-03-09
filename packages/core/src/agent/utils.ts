import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { MastraLegacyLanguageModel, MastraLanguageModel } from '../llm/model/shared.types';
import type { StorageThreadType } from '../memory';
import type { StandardSchemaWithJSON, InferStandardSchemaOutput } from '../schema';
import type { FullOutput } from '../stream/base/output';
import type { Agent } from './agent';
import type { AgentExecutionOptions, AgentExecutionOptionsBase } from './agent.types';
import type { MessageListInput } from './message-list';
import type { StructuredOutputOptions } from './types';

export const supportedLanguageModelSpecifications = ['v2', 'v3'];
export const isSupportedLanguageModel = (
  model: MastraLanguageModel | MastraLegacyLanguageModel,
): model is MastraLanguageModel => {
  return supportedLanguageModelSpecifications.includes(model.specificationVersion);
};

export async function tryGenerateWithJsonFallback<
  SCHEMA extends StandardSchemaWithJSON,
  OUTPUT extends InferStandardSchemaOutput<SCHEMA>,
>(agent: Agent, prompt: MessageListInput, options: AgentExecutionOptions<OUTPUT>): Promise<FullOutput<OUTPUT>>;
export async function tryGenerateWithJsonFallback<OUTPUT extends {}>(
  agent: Agent,
  prompt: MessageListInput,
  options: AgentExecutionOptions<OUTPUT>,
): Promise<FullOutput<OUTPUT>>;
export async function tryGenerateWithJsonFallback<OUTPUT>(
  agent: Agent,
  prompt: MessageListInput,
  options: AgentExecutionOptions<OUTPUT>,
): Promise<FullOutput<OUTPUT>> {
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

export async function tryStreamWithJsonFallback<OUTPUT extends {}>(
  agent: Agent,
  prompt: MessageListInput,
  options: AgentExecutionOptionsBase<OUTPUT> & {
    structuredOutput: StructuredOutputOptions<OUTPUT>;
  },
) {
  if (!options.structuredOutput?.schema) {
    throw new MastraError({
      id: 'STRUCTURED_OUTPUT_OPTIONS_REQUIRED',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: 'structuredOutput is required to use tryStreamWithJsonFallback',
    });
  }

  try {
    const result = await agent.stream(prompt, options);
    const object = await result.object;
    if (!object) {
      throw new MastraError({
        id: 'STRUCTURED_OUTPUT_OBJECT_UNDEFINED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'structuredOutput object is undefined',
      });
    }
    return result;
  } catch (error) {
    console.warn('Error in tryStreamWithJsonFallback. Attempting fallback.', error);
    return await agent.stream(prompt, {
      ...options,
      structuredOutput: { ...options.structuredOutput, jsonPromptInjection: true },
    });
  }
}

export function resolveThreadIdFromArgs(args: {
  memory?: { thread?: string | { id: string } };
  threadId?: string;
}): (Partial<StorageThreadType> & { id: string }) | undefined {
  if (args?.memory?.thread) {
    if (typeof args.memory.thread === 'string') return { id: args.memory.thread };
    if (typeof args.memory.thread === 'object' && args.memory.thread.id)
      return args.memory.thread as Partial<StorageThreadType> & { id: string };
  }
  if (args?.threadId) return { id: args.threadId };
  return undefined;
}

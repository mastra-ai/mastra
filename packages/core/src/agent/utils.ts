import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { MastraLegacyLanguageModel, MastraLanguageModel } from '../llm/model/shared.types';
import type { StorageThreadType } from '../memory';
import type { StandardSchemaWithJSON, InferStandardSchemaOutput } from '../schema';
import type { FullOutput } from '../stream/base/output';
import type { Agent } from './agent';
import type { AgentExecutionOptions, AgentExecutionOptionsBase } from './agent.types';
import type { MessageListInput } from './message-list';
import type { StructuredOutputOptions } from './types';

async function parseStructuredOutputText<OUTPUT>(
  textValue: string | Promise<string>,
  schema: StructuredOutputOptions<OUTPUT>['schema'],
): Promise<OUTPUT> {
  const text = (await textValue).trim();
  const jsonText = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim() ?? text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    const objectMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      throw new MastraError({
        id: 'STRUCTURED_OUTPUT_TEXT_PARSE_FAILED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'structuredOutput text did not contain parseable JSON',
      });
    }
    parsed = JSON.parse(objectMatch[0]);
  }

  const validation = await schema['~standard'].validate(parsed);
  if (validation.issues) {
    throw new MastraError({
      id: 'STRUCTURED_OUTPUT_TEXT_VALIDATION_FAILED',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: `structuredOutput text failed schema validation: ${validation.issues.map(issue => issue.message).join('; ')}`,
    });
  }

  return validation.value as OUTPUT;
}

export const supportedLanguageModelSpecifications = ['v2', 'v3', 'v4'];
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
    const result = await agent.generate(prompt, options);
    // Some models resolve without throwing but produce no parseable structured
    // object (empty/malformed JSON). Treat that the same as a thrown error so the
    // caller still gets the json-prompt-injection retry instead of a downstream
    // crash when it reads `result.object`. Mirrors tryStreamWithJsonFallback.
    if (result.object === undefined) {
      throw new MastraError({
        id: 'STRUCTURED_OUTPUT_OBJECT_UNDEFINED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'structuredOutput object is undefined',
      });
    }
    return result;
  } catch (error) {
    console.warn('Error in tryGenerateWithJsonFallback. Attempting fallback.', error);
    const result = await agent.generate(prompt, {
      ...options,
      structuredOutput: {
        ...options.structuredOutput,
        jsonPromptInjection:
          options.structuredOutput.jsonPromptInjection === 'inline' ||
          options.structuredOutput.jsonPromptInjection === 'system'
            ? options.structuredOutput.jsonPromptInjection
            : true,
      },
    });
    if (result.object === undefined) {
      return {
        ...result,
        object: await parseStructuredOutputText(result.text, options.structuredOutput.schema),
      };
    }
    return result;
  }
}

export async function tryStreamWithJsonFallback<OUTPUT extends {}>(
  agent: Agent,
  prompt: MessageListInput,
  options: AgentExecutionOptionsBase<OUTPUT> & {
    structuredOutput: StructuredOutputOptions<OUTPUT>;
    onStream?: (stream: Awaited<ReturnType<Agent['stream']>>) => void | Promise<void>;
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

  const { onStream, ...streamOptions } = options;

  try {
    const result = await agent.stream(prompt, streamOptions);
    void onStream?.(result as unknown as Awaited<ReturnType<Agent['stream']>>);
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
    const result = await agent.stream(prompt, {
      ...streamOptions,
      structuredOutput: {
        ...streamOptions.structuredOutput,
        jsonPromptInjection:
          streamOptions.structuredOutput.jsonPromptInjection === 'inline' ||
          streamOptions.structuredOutput.jsonPromptInjection === 'system'
            ? streamOptions.structuredOutput.jsonPromptInjection
            : true,
      },
    });
    void onStream?.(result as unknown as Awaited<ReturnType<Agent['stream']>>);
    const object = await result.object;
    if (object === undefined) {
      return {
        ...result,
        object: Promise.resolve(await parseStructuredOutputText(result.text, streamOptions.structuredOutput.schema)),
      };
    }
    return result;
  }
}

export function resolveThreadIdFromArgs(args: {
  memory?: { thread?: string | { id: string } };
  threadId?: string;
  overrideId?: string;
}): (Partial<StorageThreadType> & { id: string }) | undefined {
  let resolved: (Partial<StorageThreadType> & { id: string }) | undefined;

  if (args?.memory?.thread) {
    if (typeof args.memory.thread === 'string') {
      resolved = { id: args.memory.thread };
    } else if (typeof args.memory.thread === 'object' && args.memory.thread.id) {
      resolved = args.memory.thread as Partial<StorageThreadType> & { id: string };
    }
  }
  if (!resolved && args?.threadId) {
    resolved = { id: args.threadId };
  }

  if (args.overrideId) {
    return { ...(resolved || {}), id: args.overrideId };
  }

  return resolved;
}

import type { CoreMessage } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { z, ZodSchema } from 'zod';

import type { MastraPrimitives } from '../../action';
import { MastraBase } from '../../base';
import { RegisteredLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import type {
  GenerateTextWithMessagesArgs,
  GenerateTextResult,
  ToolSet,
  GenerateReturn,
  GenerateObjectResult,
  GenerateObjectWithMessagesArgs,
  StreamReturn,
  StreamTextWithMessagesArgs,
  StreamTextResult,
  StreamObjectResult,
  StreamObjectWithMessagesArgs,
} from './base.types';

export abstract class MastraLLMBase extends MastraBase {
  constructor({ name }: { name: string }) {
    super({
      component: RegisteredLogger.LLM,
      name,
    });
  }

  abstract getProvider(): string;
  abstract getModelId(): string;

  abstract __registerMastra(p: Mastra): void;

  abstract __text<Tools extends ToolSet, Z extends ZodSchema | JSONSchema7 | undefined>(
    input: GenerateTextWithMessagesArgs<Tools, Z>,
  ): Promise<GenerateTextResult<Tools, Z extends ZodSchema ? z.infer<Z> : unknown>>;

  abstract __textObject<Z extends ZodSchema | JSONSchema7>(
    input: GenerateObjectWithMessagesArgs<Z>,
  ): Promise<GenerateObjectResult<Z>>;

  abstract generate<
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
    StructuredOutput extends ZodSchema | JSONSchema7 | undefined = undefined,
    Tools extends ToolSet = ToolSet,
  >(
    messages: string | string[] | CoreMessage[],
    options: Omit<
      Output extends undefined
        ? GenerateTextWithMessagesArgs<Tools, StructuredOutput>
        : GenerateObjectWithMessagesArgs<NonNullable<Output>>,
      'messages'
    >,
  ): Promise<GenerateReturn<Tools, Output, StructuredOutput>>;

  abstract __stream<Tools extends ToolSet, Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    input: StreamTextWithMessagesArgs<Tools, Z>,
  ): StreamTextResult<Tools, Z extends ZodSchema ? z.infer<Z> : unknown>;

  abstract __streamObject<Z extends ZodSchema | JSONSchema7>(
    input: StreamObjectWithMessagesArgs<Z>,
  ): StreamObjectResult<Z>;

  abstract stream<
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
    StructuredOutput extends ZodSchema | JSONSchema7 | undefined = undefined,
    Tools extends ToolSet = ToolSet,
  >(
    messages: string | string[] | CoreMessage[],
    options: Omit<
      Output extends undefined
        ? StreamTextWithMessagesArgs<Tools, StructuredOutput>
        : StreamObjectWithMessagesArgs<NonNullable<Output>> & { maxSteps?: never },
      'messages'
    >,
  ): StreamReturn<Tools, Output, StructuredOutput>;

  convertToMessages(messages: string | string[] | CoreMessage[]): CoreMessage[] {
    if (Array.isArray(messages)) {
      return messages.map(m => {
        if (typeof m === 'string') {
          return {
            role: 'user',
            content: m,
          };
        }
        return m;
      });
    }

    return [
      {
        role: 'user',
        content: messages,
      },
    ];
  }

  __registerPrimitives(p: MastraPrimitives) {
    if (p.telemetry) {
      this.__setTelemetry(p.telemetry);
    }

    if (p.logger) {
      this.__setLogger(p.logger);
    }
  }
}

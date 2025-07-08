import type {
  CoreMessage,
  DeepPartial,
  GenerateObjectResult,
  GenerateTextResult,
  StreamObjectResult,
  StreamTextResult,
} from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';

import type {
  GenerateReturn,
  LLMInnerStreamOptions,
  LLMStreamObjectOptions,
  LLMStreamOptions,
  LLMTextObjectOptions,
  LLMTextOptions,
  StreamReturn,
} from '../';
import type { MastraPrimitives } from '../../action';
import { MastraBase } from '../../base';
import { RegisteredLogger } from '../../logger';
import type { Mastra } from '../../mastra';

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

  abstract __text<Z extends ZodSchema | JSONSchema7 | undefined>(
    input: LLMTextOptions<Z>,
  ): Promise<GenerateTextResult<any, any>>;

  abstract __textObject<T extends ZodSchema | JSONSchema7 | undefined>(
    input: LLMTextObjectOptions<T>,
  ): Promise<GenerateObjectResult<T>>;

  abstract generate<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[],
    options: LLMStreamOptions<Z>,
  ): Promise<GenerateReturn<Z>>;

  abstract __stream<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    input: LLMInnerStreamOptions<Z>,
  ): StreamTextResult<any, any>;

  abstract __streamObject<T extends ZodSchema | JSONSchema7 | undefined>(
    input: LLMStreamObjectOptions<T>,
  ): StreamObjectResult<DeepPartial<T>, T, never>;

  abstract stream<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[],
    options: LLMStreamOptions<Z>,
  ): StreamReturn<Z>;

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

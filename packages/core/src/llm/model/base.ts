import {
  type CoreMessage,
  type DeepPartial,
  type GenerateObjectResult,
  type GenerateTextResult,
  type LanguageModel,
  type StreamObjectResult,
  type StreamTextResult,
} from 'ai';
import { type JSONSchema7 } from 'json-schema';
import { ZodSchema } from 'zod';

import {
  type GenerateReturn,
  type LLMInnerStreamOptions,
  type LLMStreamObjectOptions,
  type LLMStreamOptions,
  type LLMTextObjectOptions,
  type LLMTextOptions,
  type StreamReturn,
} from '../';
import { type MastraPrimitives } from '../../action';
import { MastraBase } from '../../base';
import { RegisteredLogger } from '../../logger';

export class MastraLLMBase extends MastraBase {
  // @ts-ignore
  #mastra?: MastraPrimitives;
  #model: LanguageModel;

  constructor({ name, model }: { name: string; model: LanguageModel }) {
    super({
      component: RegisteredLogger.LLM,
      name,
    });

    this.#model = model;
  }

  getProvider() {
    return this.#model.provider;
  }

  getModelId() {
    return this.#model.modelId;
  }

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

    this.#mastra = p;
  }

  async __text(input: LLMTextOptions): Promise<GenerateTextResult<any, any>> {
    this.logger.debug(`[LLMs:${this.name}] Generating text.`, { input });
    throw new Error('Method not implemented.');
  }

  async __textObject<T>(input: LLMTextObjectOptions<T>): Promise<GenerateObjectResult<T>> {
    this.logger.debug(`[LLMs:${this.name}] Generating object.`, { input });
    throw new Error('Method not implemented.');
  }

  async generate<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[],
    options: LLMStreamOptions<Z> = {},
  ): Promise<GenerateReturn<Z>> {
    this.logger.debug(`[LLMs:${this.name}] Generating text.`, { messages, options });
    throw new Error('Method not implemented.');
  }

  async __stream(input: LLMInnerStreamOptions): Promise<StreamTextResult<any, any>> {
    this.logger.debug(`[LLMs:${this.name}] Streaming text.`, { input });
    throw new Error('Method not implemented.');
  }

  async __streamObject<T>(input: LLMStreamObjectOptions<T>): Promise<StreamObjectResult<DeepPartial<T>, T, never>> {
    this.logger.debug(`[LLMs:${this.name}] Streaming object.`, { input });
    throw new Error('Method not implemented.');
  }

  async stream<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[],
    options: LLMStreamOptions<Z> = {},
  ): Promise<StreamReturn<Z>> {
    this.logger.debug(`[LLMs:${this.name}] Streaming text.`, { messages, options });
    throw new Error('Method not implemented.');
  }
}

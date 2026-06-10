import type { SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
import { z } from 'zod/v4';
import { Agent, isSupportedLanguageModel } from '../../agent';
import type { MastraDBMessage } from '../../agent/message-list';
import type { ProviderOptions } from '../../llm/model/provider-options';
import type { MastraModelConfig } from '../../llm/model/shared.types';
import type { ObservabilityContext } from '../../observability';
import { InternalSpans, resolveObservabilityContext } from '../../observability';
import type { PublicSchema } from '../../schema';
import { standardSchemaToJSONSchema, toStandardSchema } from '../../schema';
import type { ProcessInputArgs, ProcessInputStepArgs, ProcessInputStepResult, Processor } from '../index';
import { selectMessagesToCheck } from './message-selection';
import type { LastMessageOnlyOption } from './message-selection';

type ModelSwapperRouteModel = NonNullable<ProcessInputStepResult['model']>;

export interface ModelSwapRule {
  /** Description of requests that should use this route. Used as classifier guidance. */
  description: string;
  /** Model to use when this route matches. */
  model: ModelSwapperRouteModel;
}

export interface ModelSwapperResult {
  /** Matched rule index. 0 means no match, 1 means the first rule, 2 means the second rule, and so on. */
  rule: number;
  /** Model selected by the matched rule or configured default. */
  selectedModel?: ModelSwapperRouteModel;
}

export interface ModelSwapperOptions extends LastMessageOnlyOption {
  /** Model configuration for the internal classification agent. */
  model: MastraModelConfig;
  /** Routing rules that map request descriptions to models. */
  rules: ModelSwapRule[];
  /** Model to use when no rule matches. */
  defaultModel?: ModelSwapperRouteModel;
  /** Custom classifier instructions. */
  instructions?: string;
  /** Structured output options used for the classification agent. */
  structuredOutputOptions?: {
    /** Use prompt-based JSON coercion when native structured output is unavailable. */
    jsonPromptInjection?: boolean;
  };
  /** Provider-specific options passed to the internal classification agent. */
  providerOptions?: ProviderOptions;
}

type ModelSwapperState = {
  result?: ModelSwapperResult;
};

export class ModelSwapperProcessor implements Processor<'model-swapper'> {
  readonly id = 'model-swapper';
  readonly name = 'Model Swapper';

  private classificationAgent: Agent;
  private rules: [ModelSwapRule, ...ModelSwapRule[]];
  private lastMessageOnly: boolean;
  private defaultModel?: ModelSwapperRouteModel;
  private structuredOutputOptions?: ModelSwapperOptions['structuredOutputOptions'];
  private providerOptions?: ProviderOptions;

  constructor(options: ModelSwapperOptions) {
    if (options.rules.length === 0) {
      throw new Error('ModelSwapperProcessor requires at least one rule');
    }

    this.rules = options.rules as [ModelSwapRule, ...ModelSwapRule[]];
    this.lastMessageOnly = options.lastMessageOnly ?? true;
    this.defaultModel = options.defaultModel;
    this.structuredOutputOptions = options.structuredOutputOptions;
    this.providerOptions = options.providerOptions;

    this.classificationAgent = new Agent({
      id: 'model-swapper',
      name: 'Model Swapper',
      instructions: options.instructions || this.createDefaultInstructions(),
      model: options.model,
      options: {
        tracingPolicy: { internal: InternalSpans.ALL },
      },
    });
  }

  async processInput(args: ProcessInputArgs): Promise<MastraDBMessage[]> {
    const { messages, state, ...rest } = args;
    const observabilityContext = resolveObservabilityContext(rest);

    const stateValue = state as ModelSwapperState;
    delete stateValue.result;

    if (messages.length === 0) {
      return messages;
    }

    const text = selectMessagesToCheck(messages, this.lastMessageOnly)
      .map(message => this.extractTextContent(message))
      .filter(Boolean)
      .join('\n\n');

    if (!text.trim()) {
      return messages;
    }

    const result = await this.classify(text, observabilityContext);
    stateValue.result = this.resolveResult(result);

    return messages;
  }

  processInputStep({ stepNumber, state }: ProcessInputStepArgs): ProcessInputStepResult {
    if (stepNumber !== 0) {
      return {};
    }

    const result = (state as ModelSwapperState).result;
    if (!result?.selectedModel) {
      return {};
    }

    return { model: result.selectedModel };
  }

  private async classify(content: string, observabilityContext?: ObservabilityContext): Promise<ModelSwapperResult> {
    const schema = z.object({
      rule: z.number().int().min(0).max(this.rules.length).describe('Selected rule number. Return 0 for no match.'),
    });

    try {
      const prompt = this.createClassificationPrompt(content);
      const model = await this.classificationAgent.getModel();

      if (isSupportedLanguageModel(model)) {
        const response = await this.classificationAgent.generate(prompt, {
          structuredOutput: {
            ...(this.structuredOutputOptions ?? {}),
            schema,
          },
          modelSettings: {
            temperature: 0,
          },
          providerOptions: this.providerOptions,
          ...observabilityContext,
        });

        if (!response.object) {
          throw new Error('Structured output returned no object');
        }

        return response.object as ModelSwapperResult;
      }

      const standardSchema = toStandardSchema(schema as PublicSchema);
      const response = await this.classificationAgent.generateLegacy(prompt, {
        output: standardSchemaToJSONSchema(standardSchema),
        temperature: 0,
        providerOptions: this.providerOptions as SharedV2ProviderOptions,
        ...observabilityContext,
      });

      if (!response.object) {
        throw new Error('Legacy output returned no object');
      }

      return response.object as ModelSwapperResult;
    } catch (error) {
      console.warn('[ModelSwapperProcessor] Classification agent failed, leaving model unchanged:', error);
      return {
        rule: 0,
      };
    }
  }

  private resolveResult(result: ModelSwapperResult): ModelSwapperResult {
    if (result.rule === 0) {
      return {
        ...result,
        selectedModel: this.defaultModel,
      };
    }

    const rule = this.rules[result.rule - 1];
    if (!rule) {
      return {
        rule: 0,
        selectedModel: this.defaultModel,
      };
    }

    return {
      ...result,
      selectedModel: rule.model,
    };
  }

  private createDefaultInstructions(): string {
    return 'Classify user requests for model routing. Return only the matching rule number. Return 0 when no rule matches or when uncertain.';
  }

  private createClassificationPrompt(content: string): string {
    const rules = this.rules.map((rule, index) => `${index + 1}: ${rule.description}`).join('\n');

    return `Return only one rule number.\n0: no match\n${rules}\n\nRequest:\n${content}`;
  }

  private extractTextContent(message: MastraDBMessage): string {
    let text = '';

    if (message.content.parts) {
      for (const part of message.content.parts) {
        if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
          text += `${part.text} `;
        }
      }
    }

    if (!text.trim() && typeof message.content.content === 'string') {
      text = message.content.content;
    }

    return text.trim();
  }
}

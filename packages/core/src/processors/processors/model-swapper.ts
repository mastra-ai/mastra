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
  /** Unique name the classifier must return when this route matches. */
  name: string;
  /** Description of requests that should use this route. */
  description?: string;
  /** Pattern or natural-language match criteria for this route. */
  pattern?: string;
  /** Model to use when this route matches. */
  model: ModelSwapperRouteModel;
  /** Optional categories that belong to this route. */
  categories?: string[];
  /** Optional extra matching guidance for the classifier. */
  match?: string;
  /** Route-specific confidence threshold. Falls back to the processor threshold. */
  threshold?: number;
}

export interface ModelSwapperResult {
  /** Matched rule name, or null when no route matched. */
  ruleName: string | null;
  /** Matched category, if the classifier selected one. */
  category?: string | null;
  /** Classifier confidence from 0 to 1. */
  confidence: number;
  /** Model selected by the matched rule or configured fallback/default. */
  selectedModel?: ModelSwapperRouteModel;
  /** Human-readable classifier reason. */
  reason: string | null;
}

export interface ModelSwapperOptions extends LastMessageOnlyOption {
  /** Model configuration for the internal classification agent. */
  model: MastraModelConfig;
  /** Routing rules that map request categories to models. */
  rules: ModelSwapRule[];
  /** Model to use when no rule matches. */
  defaultModel?: ModelSwapperRouteModel;
  /** Alias for defaultModel. Used when no rule matches. */
  fallbackModel?: ModelSwapperRouteModel;
  /** Custom classifier instructions. */
  instructions?: string;
  /** Minimum confidence required before a matched rule swaps models. Defaults to 0.7. */
  threshold?: number;
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

const NO_MATCH = 'NO_MATCH';

export class ModelSwapperProcessor implements Processor<'model-swapper'> {
  readonly id = 'model-swapper';
  readonly name = 'Model Swapper';

  private classificationAgent: Agent;
  private rules: [ModelSwapRule, ...ModelSwapRule[]];
  private threshold: number;
  private lastMessageOnly: boolean;
  private defaultModel?: ModelSwapperRouteModel;
  private structuredOutputOptions?: ModelSwapperOptions['structuredOutputOptions'];
  private providerOptions?: ProviderOptions;

  constructor(options: ModelSwapperOptions) {
    if (options.rules.length === 0) {
      throw new Error('ModelSwapperProcessor requires at least one rule');
    }

    this.rules = options.rules as [ModelSwapRule, ...ModelSwapRule[]];
    this.threshold = options.threshold ?? 0.7;
    this.lastMessageOnly = options.lastMessageOnly ?? true;
    this.defaultModel = options.defaultModel ?? options.fallbackModel;
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
    const ruleNames = [this.rules[0].name, ...this.rules.slice(1).map(rule => rule.name), NO_MATCH];
    const schema = z.object({
      ruleName: z.enum(ruleNames).describe('The exact matching rule name, or NO_MATCH'),
      category: z.string().nullable().describe('The matched category, if any'),
      confidence: z.number().min(0).max(1).describe('Confidence level between 0 and 1'),
      reason: z.string().nullable().describe('Brief reason for the selected route'),
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
        ruleName: null,
        category: null,
        confidence: 0,
        reason: null,
      };
    }
  }

  private resolveResult(result: ModelSwapperResult): ModelSwapperResult {
    if (!result.ruleName || result.ruleName === NO_MATCH) {
      return {
        ...result,
        ruleName: null,
        selectedModel: this.defaultModel,
      };
    }

    const rule = this.rules.find(candidate => candidate.name === result.ruleName);
    if (!rule) {
      return {
        ...result,
        ruleName: null,
        selectedModel: this.defaultModel,
      };
    }

    const threshold = rule.threshold ?? this.threshold;
    if (result.confidence < threshold) {
      return {
        ...result,
        selectedModel: this.defaultModel,
      };
    }

    return {
      ...result,
      selectedModel: rule.model,
    };
  }

  private createDefaultInstructions(): string {
    return `You classify user requests for dynamic model routing. Select exactly one configured rule when the request clearly matches that route. Return ${NO_MATCH} when no rule matches or confidence is low. Use the exact rule name provided in the prompt.`;
  }

  private createClassificationPrompt(content: string): string {
    const rules = this.rules
      .map(rule => {
        const details = [
          `name: ${rule.name}`,
          rule.description ? `description: ${rule.description}` : null,
          rule.pattern ? `pattern: ${rule.pattern}` : null,
          rule.match ? `match: ${rule.match}` : null,
          rule.categories?.length ? `categories: ${rule.categories.join(', ')}` : null,
          `threshold: ${rule.threshold ?? this.threshold}`,
        ].filter(Boolean);

        return `- ${details.join('\n  ')}`;
      })
      .join('\n');

    return `Classify the user request against these model routing rules.\n\nRules:\n${rules}\n\nReturn ${NO_MATCH} if none apply.\n\nUser request:\n${content}`;
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

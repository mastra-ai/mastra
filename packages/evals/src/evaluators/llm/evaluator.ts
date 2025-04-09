import type { LanguageModel } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Evaluator } from '@mastra/core/eval';
import type { EvaluatorSettings, EvaluationResult } from '@mastra/core/eval';
import { z } from 'zod';
import type { EvaluatorType } from '../types';
import type {
  LLMEvaluatorScorer,
  LLMEvaluatorScoreResult,
  LLMEvaluatorReasonPromptArgs,
  Outcome,
  LLMEvaluatorEvalPromptArgs,
} from './types';

export interface LLMEvaluatorPrompt<T> {
  template: string;
  format?: (args: T) => Promise<string> | string;
}

export type LLMEvaluatorReasonPrompt = LLMEvaluatorPrompt<LLMEvaluatorReasonPromptArgs>;
export type LLMEvaluatorEvalPrompt = LLMEvaluatorPrompt<LLMEvaluatorEvalPromptArgs>;

export interface EvaluatorConfig {
  name: string;
  instructions: string;
  reasonPrompt?: LLMEvaluatorReasonPrompt;
  evalPrompt?: LLMEvaluatorEvalPrompt;
  scorer: LLMEvaluatorScorer;
  model: LanguageModel;
  settings?: EvaluatorSettings;
}

/**
 * Base Evaluator class that combines the functionality of metrics and judges.
 * This class provides a unified interface for evaluating model outputs.
 */
export class LLMEvaluator extends Evaluator {
  protected agent: Agent;
  protected settings: EvaluatorSettings;
  protected _name: string;
  protected reasonPrompt?: LLMEvaluatorReasonPrompt;
  protected evalPrompt?: LLMEvaluatorEvalPrompt;
  protected scorer: LLMEvaluatorScorer;
  protected _type: EvaluatorType;
  protected _instructions: string;

  constructor(config: EvaluatorConfig) {
    super();
    this._name = config.name;
    this.settings = config.settings || {
      scale: 1,
      uncertaintyWeight: 0,
      context: [],
    };
    this.agent = new Agent({
      name: `Mastra Evaluator: ${config.name}`,
      instructions: config.instructions,
      model: config.model,
    });
    this.reasonPrompt = config.reasonPrompt;
    this.evalPrompt = config.evalPrompt;
    this.scorer = config.scorer;
    this._type = 'llm';
    this._instructions = config.instructions;
  }

  get name(): string {
    return this._name;
  }

  get type(): EvaluatorType {
    return this._type;
  }

  get model(): LanguageModel {
    return this.agent.llm.getModel();
  }

  get modelId(): string {
    return this.agent.llm.getModelId();
  }

  /**
   * Get the static template for the reasoning prompt
   */
  getReasonTemplate(): string | undefined {
    return this.reasonPrompt?.template;
  }

  /**
   * Get the static template for the evaluation prompt
   */
  getEvalTemplate(): string | undefined {
    return this.evalPrompt?.template;
  }

  /**
   * Format a template with variables
   */
  protected formatTemplate(template: string, vars: Record<string, string | number>): string {
    return template.replace(/\{([^}]+)\}/g, (_, key) => {
      const value = vars[key];
      return value !== undefined ? String(value) : `{${key}}`;
    });
  }

  get provider(): string {
    return this.agent.llm.getProvider();
  }

  get instructions(): string {
    return this._instructions;
  }

  async reason({
    input,
    output,
    eval_result,
    context,
    outcomes,
  }: {
    input: string;
    output: string;
    eval_result: LLMEvaluatorScoreResult;
    context?: string[];
    outcomes: Outcome[];
  }): Promise<string> {
    // @TODO: FIX THIS
    // get result from format, and pass to this.formatTemplate
    const prompt = this.reasonPrompt?.format
      ? await Promise.resolve(
          this.reasonPrompt.format({
            agent: this.agent,
            input,
            output,
            eval_result,
            settings: this.settings,
            outcomes,
            context,
          }),
        )
      : this.formatTemplate(this.reasonPrompt?.template || '', {
          input,
          output,
          eval_result: String(eval_result.score),
          scale: String(this.settings.scale),
          outcomes: JSON.stringify(outcomes),
          context: context?.join(', ') || '',
        });

    if (!prompt) {
      throw new Error('Reason prompt not generated.');
    }

    const result = await this.agent.generate(prompt, {
      output: z.object({
        reason: z.string(),
      }),
    });

    return result.object.reason;
  }

  async evaluate({
    input,
    output,
    context,
  }: {
    input: string;
    output: string;
    context?: string[];
  }): Promise<Outcome[]> {
    // @TODO: FIX THIS
    // get result from format, and pass to this.formatTemplate
    let prompt = this.evalPrompt?.format
      ? await Promise.resolve(
          this.evalPrompt.format({
            input,
            statements: [output],
            settings: this.settings,
            context,
            agent: this.agent,
            output,
          }),
        )
      : this.formatTemplate(this.evalPrompt?.template || '', {
          input,
          statements: [output]?.join(','),
          ...this.settings,
          context: context?.join(', ') || '',
          output,
        });

    if (!prompt) {
      return [];
    }

    const result = await this.agent.generate(prompt, {
      output: z.object({
        outcomes: z.array(
          z.object({
            outcome: z.string(),
            reason: z.string(),
            claim: z.string(),
          }),
        ),
      }),
    });

    return result.object.outcomes;
  }

  async score({
    input,
    output,
    options,
  }: {
    input: string;
    output: string;
    options?: Record<string, any>;
  }): Promise<EvaluationResult> {
    const context = options?.context || this.settings.context;
    const outcomes = await this.evaluate({ input, output, context });

    const eval_result = await Promise.resolve(
      this.scorer({
        outcomes,
        settings: { ...this.settings, ...options },
        context,
        agent: this.agent,
        input,
        output,
      }),
    );

    const reason = await this.reason({
      input,
      output,
      eval_result,
      outcomes,
      context,
    });

    return {
      score: eval_result.score,
      info: {
        reason,
        ...(eval_result.details ?? {}),
      },
    };
  }
}

import { randomUUID } from 'crypto';
import { z } from 'zod';
import { Agent } from '../agent';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { LanguageModel } from '../llm';
import type { MastraLanguageModel } from '../memory';
import { createWorkflow, createStep } from '../workflows';
import type { ScoringSamplingConfig } from './types';

interface ScorerStepDefinition {
  name: string;
  definition: any;
  isPromptObject: boolean;
}

// Pipeline scorer
interface ScorerConfig {
  name: string;
  description: string;
  judge?: {
    model: LanguageModel;
    instructions: string;
  };
}

// Standardized input type for all pipelines
interface ScorerRun {
  runId?: string;
  input?: any; // TODO: Add type
  output: any; // TODO: Add type
  runtimeContext?: Record<string, any>;
}

// Prompt object definition with conditional typing
interface PromptObject<TOutput, TAccumulated extends Record<string, any>, TStepName extends string = string> {
  description: string;
  outputSchema: z.ZodSchema<TOutput>;
  judge?: {
    model: MastraLanguageModel;
    instructions: string;
  };

  // Support both sync and async createPrompt
  createPrompt: (context: PromptObjectContext<TAccumulated, TStepName>) => string | Promise<string>;
}

// Helper types
type StepResultKey<T extends string> = `${T}StepResult`;

// Simple utility type to extract resolved types from potentially async functions
type Awaited<T> = T extends Promise<infer U> ? U : T;

// Simplified context type
type StepContext<TAccumulated extends Record<string, any>, TRun> = {
  run: TRun;
  results: TAccumulated;
};

// Simplified AccumulatedResults - don't try to resolve Promise types here
type AccumulatedResults<T extends Record<string, any>, K extends string, V> = T & Record<StepResultKey<K>, V>;

// Special context type for generateReason that includes the score
type GenerateReasonContext<TAccumulated extends Record<string, any>> = StepContext<TAccumulated, ScorerRun> & {
  score: TAccumulated extends Record<'generateScoreStepResult', infer TScore> ? TScore : never;
};

type ScorerRunResult<TAccumulatedResults extends Record<string, any>> = Promise<
  ScorerRun & {
    score: TAccumulatedResults extends Record<'generateScoreStepResult', infer TScore> ? TScore : never;
    reason?: TAccumulatedResults extends Record<'generateReasonStepResult', infer TReason> ? TReason : undefined;

    // Prompts
    preprocessPrompt?: string;
    analyzePrompt?: string;
    generateScorePrompt?: string;
    generateReasonPrompt?: string;

    // Results
    preprocessStepResult?: TAccumulatedResults extends Record<'preprocessStepResult', infer TPreprocess>
      ? TPreprocess
      : undefined;
    analyzeStepResult?: TAccumulatedResults extends Record<'analyzeStepResult', infer TAnalyze> ? TAnalyze : undefined;
  } & { runId: string }
>;

// Conditional type for PromptObject context
type PromptObjectContext<
  TAccumulated extends Record<string, any>,
  TStepName extends string,
> = TStepName extends 'generateReason' ? GenerateReasonContext<TAccumulated> : StepContext<TAccumulated, ScorerRun>;

// Function step types that support both sync and async
type FunctionStep<TAccumulated extends Record<string, any>, TRun, TOutput> =
  | ((context: StepContext<TAccumulated, TRun>) => TOutput)
  | ((context: StepContext<TAccumulated, TRun>) => Promise<TOutput>);

type GenerateReasonFunctionStep<TAccumulated extends Record<string, any>> =
  | ((context: GenerateReasonContext<TAccumulated>) => any)
  | ((context: GenerateReasonContext<TAccumulated>) => Promise<any>);

type GenerateScoreFunctionStep<TAccumulated extends Record<string, any>> =
  | ((context: StepContext<TAccumulated, ScorerRun>) => number)
  | ((context: StepContext<TAccumulated, ScorerRun>) => Promise<number>);

// Special prompt object type for generateScore that always returns a number
interface GenerateScorePromptObject<TAccumulated extends Record<string, any>> {
  description: string;
  judge?: {
    model: MastraLanguageModel;
    instructions: string;
  };
  // Support both sync and async createPrompt
  createPrompt: (context: StepContext<TAccumulated, ScorerRun>) => string | Promise<string>;
}

// Special prompt object type for generateReason that always returns a string
interface GenerateReasonPromptObject<TAccumulated extends Record<string, any>> {
  description: string;
  judge?: {
    model: MastraLanguageModel;
    instructions: string;
  };
  // Support both sync and async createPrompt
  createPrompt: (context: GenerateReasonContext<TAccumulated>) => string | Promise<string>;
}

// Step definition types that support both function and prompt object steps
type PreprocessStepDef<TAccumulated extends Record<string, any>, TOutput> =
  | FunctionStep<TAccumulated, ScorerRun, TOutput>
  | PromptObject<TOutput, TAccumulated, 'preprocess'>;

type AnalyzeStepDef<TAccumulated extends Record<string, any>, TOutput> =
  | FunctionStep<TAccumulated, ScorerRun, TOutput>
  | PromptObject<TOutput, TAccumulated, 'analyze'>;

// Conditional type for generateScore step definition
type GenerateScoreStepDef<TAccumulated extends Record<string, any>> =
  | GenerateScoreFunctionStep<TAccumulated>
  | GenerateScorePromptObject<TAccumulated>;

// Conditional type for generateReason step definition
type GenerateReasonStepDef<TAccumulated extends Record<string, any>> =
  | GenerateReasonFunctionStep<TAccumulated>
  | GenerateReasonPromptObject<TAccumulated>;

class MastraScorer<TAccumulatedResults extends Record<string, any> = {}> {
  constructor(
    private config: ScorerConfig,
    private steps: Array<ScorerStepDefinition> = [],
    private originalPromptObjects: Map<
      string,
      PromptObject<any, any, any> | GenerateReasonPromptObject<any> | GenerateScorePromptObject<any>
    > = new Map(),
  ) {}

  get name(): string {
    return this.config.name;
  }

  get description(): string {
    return this.config.description;
  }

  get judge() {
    return this.config.judge;
  }

  preprocess<TPreprocessOutput>(
    stepDef: PreprocessStepDef<TAccumulatedResults, TPreprocessOutput>,
  ): MastraScorer<AccumulatedResults<TAccumulatedResults, 'preprocess', Awaited<TPreprocessOutput>>> {
    const isPromptObj = this.isPromptObject(stepDef);

    if (isPromptObj) {
      const promptObj = stepDef as PromptObject<TPreprocessOutput, TAccumulatedResults, 'preprocess'>;
      this.originalPromptObjects.set('preprocess', promptObj);
    }

    return new MastraScorer(
      this.config,
      [
        ...this.steps,
        {
          name: 'preprocess',
          definition: stepDef as FunctionStep<any, ScorerRun, TPreprocessOutput>,
          isPromptObject: isPromptObj,
        },
      ],
      new Map(this.originalPromptObjects),
    );
  }

  analyze<TAnalyzeOutput>(
    stepDef: AnalyzeStepDef<TAccumulatedResults, TAnalyzeOutput>,
  ): MastraScorer<AccumulatedResults<TAccumulatedResults, 'analyze', Awaited<TAnalyzeOutput>>> {
    const isPromptObj = this.isPromptObject(stepDef);

    if (isPromptObj) {
      const promptObj = stepDef as PromptObject<TAnalyzeOutput, TAccumulatedResults, 'analyze'>;
      this.originalPromptObjects.set('analyze', promptObj);
    }

    return new MastraScorer(
      this.config,
      [
        ...this.steps,
        {
          name: 'analyze',
          definition: isPromptObj ? undefined : (stepDef as FunctionStep<any, ScorerRun, TAnalyzeOutput>),
          isPromptObject: isPromptObj,
        },
      ],
      new Map(this.originalPromptObjects),
    );
  }

  generateScore<TScoreOutput extends number = number>(
    stepDef: GenerateScoreStepDef<TAccumulatedResults>,
  ): MastraScorer<AccumulatedResults<TAccumulatedResults, 'generateScore', Awaited<TScoreOutput>>> {
    const isPromptObj = this.isPromptObject(stepDef);

    if (isPromptObj) {
      const promptObj = stepDef as GenerateScorePromptObject<TAccumulatedResults>;
      this.originalPromptObjects.set('generateScore', promptObj);
    }

    return new MastraScorer(
      this.config,
      [
        ...this.steps,
        {
          name: 'generateScore',
          definition: isPromptObj ? undefined : (stepDef as GenerateScoreFunctionStep<any>),
          isPromptObject: isPromptObj,
        },
      ],
      new Map(this.originalPromptObjects),
    );
  }

  generateReason<TReasonOutput = string>(
    stepDef: GenerateReasonStepDef<TAccumulatedResults>,
  ): MastraScorer<AccumulatedResults<TAccumulatedResults, 'generateReason', Awaited<TReasonOutput>>> {
    const isPromptObj = this.isPromptObject(stepDef);

    if (isPromptObj) {
      const promptObj = stepDef as GenerateReasonPromptObject<TAccumulatedResults>;
      this.originalPromptObjects.set('generateReason', promptObj);
    }

    return new MastraScorer(
      this.config,
      [
        ...this.steps,
        {
          name: 'generateReason',
          definition: isPromptObj ? undefined : (stepDef as GenerateReasonFunctionStep<any>),
          isPromptObject: isPromptObj,
        },
      ],
      new Map(this.originalPromptObjects),
    );
  }

  private get hasGenerateScore(): boolean {
    return this.steps.some(step => step.name === 'generateScore');
  }

  async run(input: ScorerRun): ScorerRunResult<TAccumulatedResults> {
    // Runtime check: execute only allowed after generateScore
    if (!this.hasGenerateScore) {
      throw new MastraError({
        id: 'MASTR_SCORER_FAILED_TO_RUN_MISSING_GENERATE_SCORE',
        domain: ErrorDomain.SCORER,
        category: ErrorCategory.USER,
        text: `Cannot execute pipeline without generateScore() step`,
        details: {
          scorerId: this.config.name,
          steps: this.steps.map(s => s.name).join(', '),
        },
      });
    }

    let runId = input.runId;
    if (!runId) {
      runId = randomUUID();
    }

    const run = { ...input, runId };

    const workflow = this.toMastraWorkflow();
    const workflowRun = await workflow.createRunAsync();
    const workflowResult = await workflowRun.start({
      inputData: {
        run,
      },
    });

    if (workflowResult.status === 'failed') {
      throw new MastraError({
        id: 'MASTR_SCORER_FAILED_TO_RUN_WORKFLOW_FAILED',
        domain: ErrorDomain.SCORER,
        category: ErrorCategory.USER,
        text: `Scorer Run Failed: ${workflowResult.error}`,
        details: {
          scorerId: this.config.name,
          steps: this.steps.map(s => s.name).join(', '),
        },
      });
    }

    return this.transformToScorerResult({ workflowResult, originalInput: run });
  }

  private isPromptObject(stepDef: any): boolean {
    // Check if it's a generateScore prompt object (has description and createPrompt, but no outputSchema)
    if (
      typeof stepDef === 'object' &&
      'description' in stepDef &&
      'createPrompt' in stepDef &&
      !('outputSchema' in stepDef)
    ) {
      return true;
    }

    // For other steps, check for description, outputSchema, and createPrompt
    const isOtherPromptObject =
      typeof stepDef === 'object' && 'description' in stepDef && 'outputSchema' in stepDef && 'createPrompt' in stepDef;

    return isOtherPromptObject;
  }

  getSteps(): Array<{ name: string; type: 'function' | 'prompt'; description?: string }> {
    return this.steps.map(step => ({
      name: step.name,
      type: step.isPromptObject ? 'prompt' : 'function',
      description: step.definition.description,
    }));
  }

  private toMastraWorkflow() {
    // Convert each scorer step to a workflow step
    const workflowSteps = this.steps.map(scorerStep => {
      return createStep({
        id: scorerStep.name,
        description: `Scorer step: ${scorerStep.name}`,
        inputSchema: z.any(),
        outputSchema: z.any(),
        execute: async ({ inputData, getInitData }) => {
          const { accumulatedResults = {}, generatedPrompts = {} } = inputData;
          const { run } = getInitData();

          const context = this.createScorerContext(scorerStep.name, run, accumulatedResults);

          let stepResult;
          let newGeneratedPrompts = generatedPrompts;
          if (scorerStep.isPromptObject) {
            const { result, prompt } = await this.executePromptStep(scorerStep, context);
            stepResult = result;
            newGeneratedPrompts = {
              ...generatedPrompts,
              [`${scorerStep.name}Prompt`]: prompt,
            };
          } else {
            stepResult = await this.executeFunctionStep(scorerStep, context);
          }

          const newAccumulatedResults = {
            ...accumulatedResults,
            [`${scorerStep.name}StepResult`]: stepResult,
          };

          return {
            stepResult,
            accumulatedResults: newAccumulatedResults,
            generatedPrompts: newGeneratedPrompts,
          };
        },
      });
    });

    const workflow = createWorkflow({
      id: `scorer-${this.config.name}`,
      description: this.config.description,
      inputSchema: z.object({
        run: z.any(), // ScorerRun
      }),
      outputSchema: z.object({
        run: z.any(),
        score: z.number(),
        reason: z.string().optional(),
        preprocessResult: z.any().optional(),
        analyzeResult: z.any().optional(),
        preprocessPrompt: z.string().optional(),
        analyzePrompt: z.string().optional(),
        generateScorePrompt: z.string().optional(),
        generateReasonPrompt: z.string().optional(),
      }),
    });

    let chainedWorkflow = workflow;
    for (const step of workflowSteps) {
      // @ts-ignore - Complain about the type mismatch when we chain the steps
      chainedWorkflow = chainedWorkflow.then(step);
    }

    return chainedWorkflow.commit();
  }

  private createScorerContext(stepName: string, run: ScorerRun, accumulatedResults: Record<string, any>) {
    if (stepName === 'generateReason') {
      const score = accumulatedResults.generateScoreStepResult;
      return { run, results: accumulatedResults, score };
    }

    return { run, results: accumulatedResults };
  }

  private async executeFunctionStep(scorerStep: ScorerStepDefinition, context: any) {
    return await scorerStep.definition(context);
  }

  private async executePromptStep(scorerStep: ScorerStepDefinition, context: any) {
    const originalStep = this.originalPromptObjects.get(scorerStep.name);
    if (!originalStep) {
      throw new Error(`Step "${scorerStep.name}" is not a prompt object`);
    }

    const prompt = await originalStep.createPrompt(context);
    const model = originalStep.judge?.model ?? this.config.judge?.model;
    const instructions = originalStep.judge?.instructions ?? this.config.judge?.instructions;

    if (!model || !instructions) {
      throw new MastraError({
        id: 'MASTR_SCORER_FAILED_TO_RUN_MISSING_MODEL_OR_INSTRUCTIONS',
        domain: ErrorDomain.SCORER,
        category: ErrorCategory.USER,
        text: `Step "${scorerStep.name}" requires a model and instructions`,
        details: {
          scorerId: this.config.name,
          step: scorerStep.name,
        },
      });
    }

    const judge = new Agent({ name: 'judge', model, instructions });

    // GenerateScore output must be a number
    if (scorerStep.name === 'generateScore') {
      const result = await judge.generate(prompt, {
        output: z.object({ score: z.number() }),
      });
      return { result: result.object.score, prompt };

      // GenerateReason output must be a string
    } else if (scorerStep.name === 'generateReason') {
      const result = await judge.generate(prompt);
      return { result: result.text, prompt };
    } else {
      const promptStep = originalStep as PromptObject<any, any, any>;
      const result = await judge.generate(prompt, {
        output: promptStep.outputSchema,
      });
      return { result: result.object, prompt };
    }
  }

  private transformToScorerResult({
    workflowResult,
    originalInput,
  }: {
    workflowResult: any;
    originalInput: ScorerRun & { runId: string };
  }) {
    const finalStepResult = workflowResult.result;
    const accumulatedResults = finalStepResult?.accumulatedResults || {};
    const generatedPrompts = finalStepResult?.generatedPrompts || {};

    return {
      ...originalInput,
      score: accumulatedResults.generateScoreStepResult,
      generateScorePrompt: generatedPrompts.generateScorePrompt,
      reason: accumulatedResults.generateReasonStepResult,
      generateReasonPrompt: generatedPrompts.generateReasonPrompt,
      preprocessStepResult: accumulatedResults.preprocessStepResult,
      preprocessPrompt: generatedPrompts.preprocessPrompt,
      analyzeStepResult: accumulatedResults.analyzeStepResult,
      analyzePrompt: generatedPrompts.analyzePrompt,
    };
  }
}

export function createScorer({ name, description, judge }: ScorerConfig): MastraScorer<{}> {
  return new MastraScorer<{}>({ name, description, judge });
}

export type MastraScorerEntry = {
  scorer: MastraScorer;
  sampling?: ScoringSamplingConfig;
};

export type MastraScorers = Record<string, MastraScorerEntry>;

// Export types and interfaces for use in test files
export type { ScorerConfig, ScorerRun, PromptObject };

export { MastraScorer };

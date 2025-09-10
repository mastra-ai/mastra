import { randomUUID } from 'crypto';
import { z } from 'zod';
import { Agent } from '../agent';
import type { TracingContext } from '../ai-tracing';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import { createWorkflow, createStep } from '../workflows';
import type { ScoringSamplingConfig } from './types';

interface ScorerStepDefinition {
  name: string;
  definition: any;
  isPromptObject: boolean;
}

// Pipeline scorer
// TInput and TRunOutput establish the type contract for the entire scorer pipeline,
// ensuring type safety flows through all steps and contexts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ScorerConfig<TName extends string = string, TInput = any, TRunOutput = any> {
  name: TName;
  description: string;
  judge?: {
    model: MastraLanguageModel;
    instructions: string;
  };
}

// Standardized input type for all pipelines
interface ScorerRun<TInput = any, TOutput = any> {
  runId?: string;
  input?: TInput;
  output: TOutput;
  groundTruth?: any;
  runtimeContext?: Record<string, any>;
  tracingContext?: TracingContext;
}

// Prompt object definition with conditional typing
interface PromptObject<
  TOutput,
  TAccumulated extends Record<string, any>,
  TStepName extends string = string,
  TInput = any,
  TRunOutput = any,
> {
  description: string;
  outputSchema: z.ZodSchema<TOutput>;
  judge?: {
    model: MastraLanguageModel;
    instructions: string;
  };

  // Support both sync and async createPrompt
  createPrompt: (context: PromptObjectContext<TAccumulated, TStepName, TInput, TRunOutput>) => string | Promise<string>;
}

// Helper types
type StepResultKey<T extends string> = `${T}StepResult`;

// Simple utility type to extract resolved types from potentially async functions
type Awaited<T> = T extends Promise<infer U> ? U : T;

// Simplified context type
type StepContext<TAccumulated extends Record<string, any>, TInput, TRunOutput> = {
  run: ScorerRun<TInput, TRunOutput>;
  results: TAccumulated;
};

// Simplified AccumulatedResults - don't try to resolve Promise types here
type AccumulatedResults<T extends Record<string, any>, K extends string, V> = T & Record<StepResultKey<K>, V>;

// Special context type for generateReason that includes the score
type GenerateReasonContext<TAccumulated extends Record<string, any>, TInput, TRunOutput> = StepContext<
  TAccumulated,
  TInput,
  TRunOutput
> & {
  score: TAccumulated extends Record<'generateScoreStepResult', infer TScore> ? TScore : never;
};

type ScorerRunResult<TAccumulatedResults extends Record<string, any>, TInput, TRunOutput> = Promise<
  ScorerRun<TInput, TRunOutput> & {
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
  TInput,
  TRunOutput,
> = TStepName extends 'generateReason'
  ? GenerateReasonContext<TAccumulated, TInput, TRunOutput>
  : StepContext<TAccumulated, TInput, TRunOutput>;

// Function step types that support both sync and async
type FunctionStep<TAccumulated extends Record<string, any>, TInput, TRunOutput, TOutput> =
  | ((context: StepContext<TAccumulated, TInput, TRunOutput>) => TOutput)
  | ((context: StepContext<TAccumulated, TInput, TRunOutput>) => Promise<TOutput>);

type GenerateReasonFunctionStep<TAccumulated extends Record<string, any>, TInput, TRunOutput> =
  | ((context: GenerateReasonContext<TAccumulated, TInput, TRunOutput>) => any)
  | ((context: GenerateReasonContext<TAccumulated, TInput, TRunOutput>) => Promise<any>);

type GenerateScoreFunctionStep<TAccumulated extends Record<string, any>, TInput, TRunOutput> =
  | ((context: StepContext<TAccumulated, TInput, TRunOutput>) => number)
  | ((context: StepContext<TAccumulated, TInput, TRunOutput>) => Promise<number>);

// Special prompt object type for generateScore that always returns a number
interface GenerateScorePromptObject<TAccumulated extends Record<string, any>, TInput, TRunOutput> {
  description: string;
  judge?: {
    model: MastraLanguageModel;
    instructions: string;
  };
  // Support both sync and async createPrompt
  createPrompt: (context: StepContext<TAccumulated, TInput, TRunOutput>) => string | Promise<string>;
}

// Special prompt object type for generateReason that always returns a string
interface GenerateReasonPromptObject<TAccumulated extends Record<string, any>, TInput, TRunOutput> {
  description: string;
  judge?: {
    model: MastraLanguageModel;
    instructions: string;
  };
  // Support both sync and async createPrompt
  createPrompt: (context: GenerateReasonContext<TAccumulated, TInput, TRunOutput>) => string | Promise<string>;
}

// Step definition types that support both function and prompt object steps
type PreprocessStepDef<TAccumulated extends Record<string, any>, TStepOutput, TInput, TRunOutput> =
  | FunctionStep<TAccumulated, TInput, TRunOutput, TStepOutput>
  | PromptObject<TStepOutput, TAccumulated, 'preprocess', TInput, TRunOutput>;

type AnalyzeStepDef<TAccumulated extends Record<string, any>, TStepOutput, TInput, TRunOutput> =
  | FunctionStep<TAccumulated, TInput, TRunOutput, TStepOutput>
  | PromptObject<TStepOutput, TAccumulated, 'analyze', TInput, TRunOutput>;

// Conditional type for generateScore step definition
type GenerateScoreStepDef<TAccumulated extends Record<string, any>, TInput, TRunOutput> =
  | GenerateScoreFunctionStep<TAccumulated, TInput, TRunOutput>
  | GenerateScorePromptObject<TAccumulated, TInput, TRunOutput>;

// Conditional type for generateReason step definition
type GenerateReasonStepDef<TAccumulated extends Record<string, any>, TInput, TRunOutput> =
  | GenerateReasonFunctionStep<TAccumulated, TInput, TRunOutput>
  | GenerateReasonPromptObject<TAccumulated, TInput, TRunOutput>;

class MastraScorer<
  TName extends string = string,
  TInput = any,
  TRunOutput = any,
  TAccumulatedResults extends Record<string, any> = {},
> {
  constructor(
    public config: ScorerConfig<TName, TInput, TRunOutput>,
    private steps: Array<ScorerStepDefinition> = [],
    private originalPromptObjects: Map<
      string,
      | PromptObject<any, any, any, TInput, TRunOutput>
      | GenerateReasonPromptObject<any, TInput, TRunOutput>
      | GenerateScorePromptObject<any, TInput, TRunOutput>
    > = new Map(),
  ) {}

  get name(): TName {
    return this.config.name;
  }

  get description(): string {
    return this.config.description;
  }

  get judge() {
    return this.config.judge;
  }

  preprocess<TPreprocessOutput>(
    stepDef: PreprocessStepDef<TAccumulatedResults, TPreprocessOutput, TInput, TRunOutput>,
  ): MastraScorer<
    TName,
    TInput,
    TRunOutput,
    AccumulatedResults<TAccumulatedResults, 'preprocess', Awaited<TPreprocessOutput>>
  > {
    const isPromptObj = this.isPromptObject(stepDef);

    if (isPromptObj) {
      const promptObj = stepDef as PromptObject<
        TPreprocessOutput,
        TAccumulatedResults,
        'preprocess',
        TInput,
        TRunOutput
      >;
      this.originalPromptObjects.set('preprocess', promptObj);
    }

    return new MastraScorer(
      this.config,
      [
        ...this.steps,
        {
          name: 'preprocess',
          definition: stepDef as FunctionStep<any, TInput, TRunOutput, TPreprocessOutput>,
          isPromptObject: isPromptObj,
        },
      ],
      new Map(this.originalPromptObjects),
    );
  }

  analyze<TAnalyzeOutput>(
    stepDef: AnalyzeStepDef<TAccumulatedResults, TAnalyzeOutput, TInput, TRunOutput>,
  ): MastraScorer<
    TName,
    TInput,
    TRunOutput,
    AccumulatedResults<TAccumulatedResults, 'analyze', Awaited<TAnalyzeOutput>>
  > {
    const isPromptObj = this.isPromptObject(stepDef);

    if (isPromptObj) {
      const promptObj = stepDef as PromptObject<TAnalyzeOutput, TAccumulatedResults, 'analyze', TInput, TRunOutput>;
      this.originalPromptObjects.set('analyze', promptObj);
    }

    return new MastraScorer(
      this.config,
      [
        ...this.steps,
        {
          name: 'analyze',
          definition: isPromptObj ? undefined : (stepDef as FunctionStep<any, TInput, TRunOutput, TAnalyzeOutput>),
          isPromptObject: isPromptObj,
        },
      ],
      new Map(this.originalPromptObjects),
    );
  }

  generateScore<TScoreOutput extends number = number>(
    stepDef: GenerateScoreStepDef<TAccumulatedResults, TInput, TRunOutput>,
  ): MastraScorer<
    TName,
    TInput,
    TRunOutput,
    AccumulatedResults<TAccumulatedResults, 'generateScore', Awaited<TScoreOutput>>
  > {
    const isPromptObj = this.isPromptObject(stepDef);

    if (isPromptObj) {
      const promptObj = stepDef as GenerateScorePromptObject<TAccumulatedResults, TInput, TRunOutput>;
      this.originalPromptObjects.set('generateScore', promptObj);
    }

    return new MastraScorer(
      this.config,
      [
        ...this.steps,
        {
          name: 'generateScore',
          definition: isPromptObj ? undefined : (stepDef as GenerateScoreFunctionStep<any, TInput, TRunOutput>),
          isPromptObject: isPromptObj,
        },
      ],
      new Map(this.originalPromptObjects),
    );
  }

  generateReason<TReasonOutput = string>(
    stepDef: GenerateReasonStepDef<TAccumulatedResults, TInput, TRunOutput>,
  ): MastraScorer<
    TName,
    TInput,
    TRunOutput,
    AccumulatedResults<TAccumulatedResults, 'generateReason', Awaited<TReasonOutput>>
  > {
    const isPromptObj = this.isPromptObject(stepDef);

    if (isPromptObj) {
      const promptObj = stepDef as GenerateReasonPromptObject<TAccumulatedResults, TInput, TRunOutput>;
      this.originalPromptObjects.set('generateReason', promptObj);
    }

    return new MastraScorer(
      this.config,
      [
        ...this.steps,
        {
          name: 'generateReason',
          definition: isPromptObj ? undefined : (stepDef as GenerateReasonFunctionStep<any, TInput, TRunOutput>),
          isPromptObject: isPromptObj,
        },
      ],
      new Map(this.originalPromptObjects),
    );
  }

  private get hasGenerateScore(): boolean {
    return this.steps.some(step => step.name === 'generateScore');
  }

  async run(input: ScorerRun<TInput, TRunOutput>): ScorerRunResult<TAccumulatedResults, TInput, TRunOutput> {
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

    const { tracingContext } = input;

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
      tracingContext,
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
        execute: async ({ inputData, getInitData, tracingContext }) => {
          const { accumulatedResults = {}, generatedPrompts = {} } = inputData;
          const { run } = getInitData();

          const context = this.createScorerContext(scorerStep.name, run, accumulatedResults);

          let stepResult;
          let newGeneratedPrompts = generatedPrompts;
          if (scorerStep.isPromptObject) {
            const { result, prompt } = await this.executePromptStep(scorerStep, tracingContext, context);
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

  private createScorerContext(
    stepName: string,
    run: ScorerRun<TInput, TRunOutput>,
    accumulatedResults: Record<string, any>,
  ) {
    if (stepName === 'generateReason') {
      const score = accumulatedResults.generateScoreStepResult;
      return { run, results: accumulatedResults, score };
    }

    return { run, results: accumulatedResults };
  }

  private async executeFunctionStep(scorerStep: ScorerStepDefinition, context: any) {
    return await scorerStep.definition(context);
  }

  private async executePromptStep(scorerStep: ScorerStepDefinition, tracingContext: TracingContext, context: any) {
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
      let result;
      if (model.specificationVersion === 'v2') {
        result = await judge.generateVNext(prompt, {
          output: z.object({ score: z.number() }),
          tracingContext,
        });
      } else {
        result = await judge.generate(prompt, {
          output: z.object({ score: z.number() }),
          tracingContext,
        });
      }
      return { result: result.object.score, prompt };

      // GenerateReason output must be a string
    } else if (scorerStep.name === 'generateReason') {
      let result;
      if (model.specificationVersion === 'v2') {
        result = await judge.generateVNext(prompt, { tracingContext });
      } else {
        result = await judge.generate(prompt, { tracingContext });
      }
      return { result: result.text, prompt };
    } else {
      const promptStep = originalStep as PromptObject<any, any, any, TInput, TRunOutput>;
      let result;
      if (model.specificationVersion === 'v2') {
        result = await judge.generateVNext(prompt, {
          output: promptStep.outputSchema,
          tracingContext,
        });
      } else {
        result = await judge.generate(prompt, {
          output: promptStep.outputSchema,
          tracingContext,
        });
      }
      return { result: result.object, prompt };
    }
  }

  private transformToScorerResult({
    workflowResult,
    originalInput,
  }: {
    workflowResult: any;
    originalInput: ScorerRun<TInput, TRunOutput> & { runId: string };
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

export function createScorer<TInput = any, TRunOutput = any, TName extends string = string>(
  config: ScorerConfig<TName, TInput, TRunOutput>,
): MastraScorer<TName, TInput, TRunOutput, {}> {
  return new MastraScorer<TName, TInput, TRunOutput, {}>({
    name: config.name,
    description: config.description,
    judge: config.judge,
  });
}

export type MastraScorerEntry = {
  scorer: MastraScorer<any, any, any>;
  sampling?: ScoringSamplingConfig;
};

export type MastraScorers = Record<string, MastraScorerEntry>;

// Export types and interfaces for use in test files
export type { ScorerConfig, ScorerRun, PromptObject };

export { MastraScorer };

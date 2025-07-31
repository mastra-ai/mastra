import { z } from 'zod';
import { Agent } from '../agent';
import type { LanguageModel } from '../llm';
import type { MastraLanguageModel } from '../memory';
import { createWorkflow, createStep } from '../workflows';

interface ScorerStepDefinition {
  name: string;
  definition: any;
  isPromptObject: boolean;
}

// Pipeline metadata
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

type ScorerResult<TAccumulatedResults extends Record<string, any>> = Promise<{
  run: ScorerRun;
  score: TAccumulatedResults extends Record<'generateScoreStepResult', infer TScore> ? TScore : never;
  reason?: TAccumulatedResults extends Record<'generateReasonStepResult', infer TReason> ? TReason : undefined;

  // Prompts
  preprocessPrompt?: string;
  analyzePrompt?: string;
  generateScorePrompt?: string;
  generateReasonPrompt?: string;

  // Results
  preprocessResult?: TAccumulatedResults extends Record<'preprocessStepResult', infer TPreprocess>
    ? TPreprocess
    : undefined;
  analyzeResult?: TAccumulatedResults extends Record<'analyzeStepResult', infer TAnalyze> ? TAnalyze : undefined;
}>;

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

// Prompt object definition with conditional typing
interface PromptObject<TOutput, TAccumulated extends Record<string, any>, TStepName extends string = string> {
  description: string;
  outputSchema: z.ZodSchema<TOutput>;
  judge: {
    model: MastraLanguageModel;
    instructions: string;
  };

  // Support both sync and async createPrompt
  createPrompt: (context: PromptObjectContext<TAccumulated, TStepName>) => string | Promise<string>;
}

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

class MastraNewScorer<TAccumulatedResults extends Record<string, any> = {}> {
  constructor(
    private metadata: ScorerConfig,
    private steps: Array<ScorerStepDefinition> = [],
    private originalPromptObjects: Map<
      string,
      PromptObject<any, any, any> | GenerateReasonPromptObject<any> | GenerateScorePromptObject<any>
    > = new Map(),
  ) {}

  get name(): string {
    return this.metadata.name;
  }

  get description(): string {
    return this.metadata.description;
  }

  get judge() {
    return this.metadata.judge;
  }

  preprocess<TPreprocessOutput>(
    stepDef: PreprocessStepDef<TAccumulatedResults, TPreprocessOutput>,
  ): MastraNewScorer<AccumulatedResults<TAccumulatedResults, 'preprocess', Awaited<TPreprocessOutput>>> {
    const isPromptObj = this.isPromptObject(stepDef);

    if (isPromptObj) {
      const promptObj = stepDef as PromptObject<TPreprocessOutput, TAccumulatedResults, 'preprocess'>;
      this.originalPromptObjects.set('preprocess', promptObj);
    }

    return new MastraNewScorer(
      this.metadata,
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
  ): MastraNewScorer<AccumulatedResults<TAccumulatedResults, 'analyze', Awaited<TAnalyzeOutput>>> {
    const isPromptObj = this.isPromptObject(stepDef);

    if (isPromptObj) {
      const promptObj = stepDef as PromptObject<TAnalyzeOutput, TAccumulatedResults, 'analyze'>;
      this.originalPromptObjects.set('analyze', promptObj);
    }

    return new MastraNewScorer(
      this.metadata,
      [
        ...this.steps,
        {
          name: 'analyze',
          definition: stepDef as FunctionStep<any, ScorerRun, TAnalyzeOutput>,
          isPromptObject: isPromptObj,
        },
      ],
      new Map(this.originalPromptObjects),
    );
  }

  generateScore<TScoreOutput extends number = number>(
    stepDef: GenerateScoreStepDef<TAccumulatedResults>,
  ): MastraNewScorer<AccumulatedResults<TAccumulatedResults, 'generateScore', Awaited<TScoreOutput>>> {
    const isPromptObj = this.isPromptObject(stepDef);

    if (isPromptObj) {
      const promptObj = stepDef as GenerateScorePromptObject<TAccumulatedResults>;
      this.originalPromptObjects.set('generateScore', promptObj);
    }

    const executeFunction = stepDef as GenerateScoreFunctionStep<any>;

    return new MastraNewScorer(
      this.metadata,
      [
        ...this.steps,
        {
          name: 'generateScore',
          definition: executeFunction,
          isPromptObject: isPromptObj,
        },
      ],
      new Map(this.originalPromptObjects),
    );
  }

  generateReason<TReasonOutput = string>(
    stepDef: GenerateReasonStepDef<TAccumulatedResults>,
  ): MastraNewScorer<AccumulatedResults<TAccumulatedResults, 'generateReason', Awaited<TReasonOutput>>> {
    if (!this.hasGenerateScore) {
      throw new Error(`Pipeline "${this.metadata.name}": generateReason() can only be called after generateScore()`);
    }

    const isPromptObj = this.isPromptObject(stepDef);

    if (isPromptObj) {
      const promptObj = stepDef as GenerateReasonPromptObject<TAccumulatedResults>;
      this.originalPromptObjects.set('generateReason', promptObj);
    }

    const executeFunction = stepDef as GenerateReasonFunctionStep<any>;

    return new MastraNewScorer(
      this.metadata,
      [
        ...this.steps,
        {
          name: 'generateReason',
          definition: executeFunction,
          isPromptObject: isPromptObj,
        },
      ],
      new Map(this.originalPromptObjects),
    );
  }

  private get hasGenerateScore(): boolean {
    return this.steps.some(step => step.name === 'generateScore');
  }

  async run(input: ScorerRun): ScorerResult<TAccumulatedResults> {
    // Runtime check: execute only allowed after generateScore
    if (!this.hasGenerateScore) {
      throw new Error(
        `Pipeline "${this.metadata.name}": Cannot execute pipeline without generateScore() step. ` +
          `Current steps: [${this.steps.map(s => s.name).join(', ')}]`,
      );
    }

    const workflow = this.toMastraWorkflow();
    const workflowRun = await workflow.createRunAsync();
    const workflowResult = await workflowRun.start({
      inputData: {
        run: input,
      },
    });

    return this.transformToScorerResult(workflowResult, input);
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
    if (!this.hasGenerateScore) {
      throw new Error(`Cannot execute pipeline without generateScore() step`);
    }

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
      id: `scorer-${this.metadata.name}`,
      description: this.metadata.description,
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
      if (score === undefined) {
        throw new Error(`generateReason step requires a score from generateScore step`);
      }
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

    // GenerateScore output must be a number
    if (scorerStep.name === 'generateScore') {
      const model = originalStep.judge?.model ?? this.metadata.judge?.model;
      const instructions = originalStep.judge?.instructions ?? this.metadata.judge?.instructions;

      if (!model || !instructions) {
        throw new Error(`generateScore step requires a model and instructions`);
      }

      const judge = new Agent({ name: 'judge', model, instructions });
      const result = await judge.generate(prompt, {
        output: z.object({ score: z.number() }),
      });
      return { result: result.object.score, prompt };

      // GenerateReason output must be a string
    } else if (scorerStep.name === 'generateReason') {
      const model = originalStep.judge?.model ?? this.metadata.judge?.model;
      const instructions = originalStep.judge?.instructions ?? this.metadata.judge?.instructions;

      if (!model || !instructions) {
        throw new Error(`generateReason step requires a model and instructions`);
      }

      const judge = new Agent({ name: 'judge', model, instructions });
      const result = await judge.generate(prompt);
      return { result: result.text, prompt };
    } else {
      const promptStep = originalStep as PromptObject<any, any, any>;
      const model = promptStep.judge?.model ?? this.metadata.judge?.model;
      const instructions = promptStep.judge?.instructions ?? this.metadata.judge?.instructions;

      if (!model || !instructions) {
        throw new Error(`${scorerStep.name} step requires a model and instructions`);
      }

      const judge = new Agent({ name: 'judge', model, instructions });

      const result = await judge.generate(prompt, {
        output: promptStep.outputSchema,
      });
      return { result: result.object, prompt };
    }
  }

  private transformToScorerResult(workflowResult: any, originalInput: ScorerRun) {
    const finalStepResult = workflowResult.result;
    const accumulatedResults = finalStepResult?.accumulatedResults || {};
    const generatedPrompts = finalStepResult?.generatedPrompts || {};

    return {
      run: originalInput,
      score: accumulatedResults.generateScoreStepResult,
      reason: accumulatedResults.generateReasonStepResult,
      preprocessPrompt: generatedPrompts.preprocessPrompt,
      analyzePrompt: generatedPrompts.analyzePrompt,
      generateScorePrompt: generatedPrompts.generateScorePrompt,
      generateReasonPrompt: generatedPrompts.generateReasonPrompt,
      preprocessResult: accumulatedResults.preprocessStepResult,
      analyzeResult: accumulatedResults.analyzeStepResult,
    };
  }
}

export function createNewScorer({ name, description, judge }: ScorerConfig): MastraNewScorer<{}> {
  return new MastraNewScorer<{}>({ name, description, judge });
}

// Export types and interfaces for use in test files
export type { ScorerConfig, ScorerRun, StepContext, PromptObject };

export { MastraNewScorer };

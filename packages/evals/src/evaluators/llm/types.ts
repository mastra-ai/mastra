import type { Agent } from '@mastra/core/agent';
import type { EvaluatorSettings } from '@mastra/core/eval';

export type InputOutputPair = {
  input: string;
  output: string;
};

export type TestCase = InputOutputPair & {
  context?: string[];
  expectedResult: {
    score: number;
    reason?: string;
  };
};

export type Outcome = {
  outcome: string;
  reason: string;
  claim: string;
};

export type LLMEvaluatorScoreResult = { score: number; details?: Record<string, any> };

export type LLMEvaluatorReasonPromptArgs = InputOutputPair & {
  agent: Agent;
  eval_result: LLMEvaluatorScoreResult;
  settings: EvaluatorSettings;
  context?: string[];
  outcomes: Outcome[];
};

export interface LLMEvaluatorPrompt<T> {
  template: string;
  format?: (args: T) => Promise<string> | string;
}

export type LLMEvaluatorReasonPrompt = LLMEvaluatorPrompt<LLMEvaluatorReasonPromptArgs>;

export type LLMEvaluatorEvalPromptArgs = {
  input: string;
  output: string;
  statements?: string[];
  agent: Agent;
  settings: EvaluatorSettings;
  context?: string[];
};

export type LLMEvaluatorEvalPrompt = LLMEvaluatorPrompt<LLMEvaluatorEvalPromptArgs>;

export type LLMEvaluatorScorerArgs = InputOutputPair & {
  agent: Agent;
  context?: string[];
  settings: EvaluatorSettings;
  outcomes: Outcome[];
};

export type LLMEvaluatorScorer = (
  args: LLMEvaluatorScorerArgs,
) => Promise<LLMEvaluatorScoreResult> | LLMEvaluatorScoreResult;

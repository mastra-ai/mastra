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

export type LLMEvaluatorReasonPrompt = (args: LLMEvaluatorReasonPromptArgs) => Promise<string> | string;

export type LLMEvaluatorPromptArgs = InputOutputPair & {
  agent: Agent;
  context?: string[];
  [key: string]: any;
};

export type LLMEvaluatorEvalPrompt = (args: LLMEvaluatorPromptArgs) => Promise<string> | string;

export type LLMEvaluatorScorerArgs = InputOutputPair & {
  agent: Agent;
  context?: string[];
  settings: EvaluatorSettings;
  outcomes: Outcome[];
};

export type LLMEvaluatorScorer = (
  args: LLMEvaluatorScorerArgs,
) => Promise<LLMEvaluatorScoreResult> | LLMEvaluatorScoreResult;

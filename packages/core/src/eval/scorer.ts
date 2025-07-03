import type { UIMessage } from 'ai';
import type { MessageList } from '../agent';
import type { Mastra } from '../mastra';

export type ScoreResult = {
  score: number;
  results: {
    result: string;
    reason: string;
  }[];
  input: string;
  output: string;
};

export type ScoringPrompts = {
  description: string;
  prompt: string;
};

export abstract class Scorer {
  abstract name: string;
  abstract description: string;
  abstract score({ input, output }: { input: string; output: string }): Promise<ScoreResult>;
}

export type ScoringSource = 'LIVE';
export type ScoringEntityType = 'AGENT';

export type ScorerHookData = {
  runId: string;
  traceId?: string;
  scorer: Record<string, any>;
  input: UIMessage[];
  output: Record<string, any>;
  additionalContext?: Record<string, any>;
  resourceId?: string;
  threadId?: string;
  source: ScoringSource;
  entity: Record<string, any>;
  entityType: ScoringEntityType;
  runtimeContext: Record<string, any>;
};
export abstract class LLMScorer extends Scorer {
  abstract prompts(): Record<string, ScoringPrompts>;
}

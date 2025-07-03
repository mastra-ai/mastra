import type { UIMessage } from 'ai';

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

export type ScoreRowData = {
  id: string;
  traceId?: string;
  runId: string;
  scorer: Record<string, any>;
  result: Record<string, any>;
  metadata?: Record<string, any>;
  input: Record<string, any>; // MESSAGE INPUT
  output: Record<string, any>; // MESSAGE OUTPUT
  additionalLLMContext?: Record<string, any>; // DATA FROM THE CONTEXT PARAM ON AN AGENT
  runtimeContext?: Record<string, any>; // THE EVALUATE RUNTIME CONTEXT FOR THE RUN
  entityType?: string; // WORKFLOW, AGENT, TOOL, STEP, NETWORK
  entity?: Record<string, any>; // MINIMAL JSON DATA ABOUT WORKFLOW, AGENT, TOOL, STEP, NETWORK
  source: string;
  resourceId?: string;
  threadId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export abstract class LLMScorer extends Scorer {
  abstract prompts(): Record<string, ScoringPrompts>;
}

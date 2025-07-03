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

export abstract class LLMScorer extends Scorer {
  abstract prompts(): Record<string, ScoringPrompts>;
}

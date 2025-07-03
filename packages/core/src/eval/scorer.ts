export type ScoreResult = {
  score: number;
  results: {
    result: string;
    reason: string;
  }[];
  input: string;
  output: string;
};

export abstract class Scorer {
  abstract score({ input, output }: { input: string; output: string }): Promise<ScoreResult>;
}

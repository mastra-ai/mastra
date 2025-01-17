export interface MetricScoringResult {
  score: number; // 0-1 normalized score
  weight?: number;
  details: string; // Human-readable explanation
  confidence: number; // 0-1 confidence level
  metrics?: Record<string, number | boolean | Record<string, any>>; // Additional numerical metrics
}

export interface MetricOptions {
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
  // Add more options as needed
}

export interface ScoringResult {
  score: number; // 0-1 normalized score
  weight?: number;
  details: string; // Human-readable explanation
  confidence: number; // 0-1 confidence level
  metrics?: Record<string, number | boolean | Record<string, any>>; // Additional numerical metrics
}

export interface ScorerOptions {
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
  // Add more options as needed
}

export interface JudgingConfig {
  name: string;
  scorers: ScorerConfig[];
  aggregationStrategy?: 'weighted' | 'minimum' | 'maximum' | 'average';
  metadataCollectors?: MetadataCollector[];
}

export interface ScorerConfig {
  scorer: any; // Instance of a scorer
  weight: number;
  threshold?: number; // Minimum acceptable score
  category?: string; // For grouping related scores
}

export interface MetadataCollector {
  name: string;
  collect: (response: string, context: JudgingContext) => Promise<Record<string, any>>;
}

export interface JudgingContext {
  prompt?: string;
  reference?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface JudgingResult {
  score: number;
  confidence: number;
  details: {
    overallScore: number;
    categoryScores: Record<string, number>;
    individualScores: Record<string, ScoringResult>;
    failedThresholds: string[];
    metadata: Record<string, any>;
  };
  feedback: string[];
}

/**
 * Run Analytics Types
 *
 * Types for comparing runs and computing aggregate statistics.
 * Supports regression detection for CI/CD quality gates.
 */

// ============================================================================
// Per-Scorer Statistics
// ============================================================================

/**
 * Aggregate statistics for a single scorer across a run.
 */
export interface ScorerStats {
  /** Items with null score / total items */
  errorRate: number;
  /** Count of items with null score */
  errorCount: number;
  /** Items >= threshold / items with scores */
  passRate: number;
  /** Count of items that passed threshold */
  passCount: number;
  /** Mean of non-null scores */
  avgScore: number;
  /** Count of items with non-null scores */
  scoreCount: number;
  /** Total items evaluated by this scorer */
  totalItems: number;
}

// ============================================================================
// Comparison Types
// ============================================================================

/**
 * Per-scorer comparison between two runs.
 */
export interface ScorerComparison {
  /** Stats from run A (baseline) */
  statsA: ScorerStats;
  /** Stats from run B (candidate) */
  statsB: ScorerStats;
  /** avgScore difference: statsB.avgScore - statsA.avgScore */
  delta: number;
  /** Whether this scorer regressed (delta below threshold) */
  regressed: boolean;
  /** Threshold used for regression detection */
  threshold: number;
}

/**
 * Per-item comparison showing score differences.
 */
export interface ItemComparison {
  /** Dataset item ID */
  itemId: string;
  /** Whether item exists in both runs */
  inBothRuns: boolean;
  /** Scores from run A by scorer ID (null if no score) */
  scoresA: Record<string, number | null>;
  /** Scores from run B by scorer ID (null if no score) */
  scoresB: Record<string, number | null>;
}

/**
 * Top-level comparison result.
 */
export interface ComparisonResult {
  /** Run A metadata */
  runA: {
    id: string;
    datasetVersion: Date;
  };
  /** Run B metadata */
  runB: {
    id: string;
    datasetVersion: Date;
  };
  /** True if runs used different dataset versions */
  versionMismatch: boolean;
  /** True if any scorer regressed (for CI quick check) */
  hasRegression: boolean;
  /** Per-scorer comparison results */
  scorers: Record<string, ScorerComparison>;
  /** Per-item comparison details */
  items: ItemComparison[];
  /** Warning messages (e.g., version mismatch, no overlap) */
  warnings: string[];
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Threshold configuration for a single scorer.
 */
export interface ScorerThreshold {
  /** Absolute threshold value for regression detection */
  value: number;
  /** Score direction: 'higher-is-better' (default) or 'lower-is-better' */
  direction?: 'higher-is-better' | 'lower-is-better';
}

/**
 * Configuration for compareRuns function.
 */
export interface CompareRunsConfig {
  /** ID of run A (baseline) */
  runIdA: string;
  /** ID of run B (candidate) */
  runIdB: string;
  /**
   * Per-scorer thresholds for regression detection.
   * Key is scorer ID, value is threshold config.
   * Default when not specified: { value: 0, direction: 'higher-is-better' }
   */
  thresholds?: Record<string, ScorerThreshold>;
}

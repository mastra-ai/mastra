import { MemoryConfig } from '@mastra/core/memory';

export type QuestionType =
  | 'single-session-user'
  | 'single-session-assistant'
  | 'single-session-preference'
  | 'temporal-reasoning'
  | 'knowledge-update'
  | 'multi-session';

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
  has_answer?: boolean;
}

export interface LongMemEvalQuestion {
  question_id: string;
  question_type: QuestionType;
  question: string;
  improved_question?: string; // Clarified version for vague/ambiguous questions
  improved_answer?: string; // Updated answer for the clarified question (if different)
  improvement_note?: string; // Notes about why this question failed (for tracking investigated failures)
  requires_retry?: boolean; // Eval agent sometimes fails due to poor reasoning, retry once on failure
  answer: string;
  question_date: string;
  haystack_session_ids: string[];
  haystack_dates: string[];
  haystack_sessions: Turn[][];
  answer_session_ids: string[];
}

export interface EvaluationResult {
  question_id: string;
  question: string; // The original question asked
  expected_answer: string; // The expected answer
  hypothesis: string;
  autoeval_label?: boolean;
  question_type?: QuestionType;
  is_correct?: boolean;
  // For improved_question support
  improved_question?: string;
  improved_hypothesis?: string;
  improved_is_correct?: boolean;
  // Track if this question has any improvement info (for filtering uninvestigated failures)
  has_improvement_info?: boolean;
}

export type DatasetType = 'longmemeval_s' | 'longmemeval_m' | 'longmemeval_oracle';

export type MemoryConfigType =
  | 'semantic-recall'
  | 'working-memory'
  | 'working-memory-tailored'
  | 'combined'
  | 'combined-tailored'
  | 'observational-memory'
  | 'observational-memory-shortcut'
  | 'observational-memory-shortcut-glm';

export interface MemoryConfigOptions {
  type: MemoryConfigType;
  options: MemoryConfig;
}

export interface BenchmarkMetrics {
  overall_accuracy: number;
  accuracy_by_type: Partial<Record<QuestionType, { correct: number; total: number; accuracy: number }>>;
  abstention_accuracy: number;
  session_recall_accuracy?: number;
  turn_recall_accuracy?: number;
  total_questions: number;
  correct_answers: number;
  abstention_correct?: number;
  abstention_total?: number;
  // For improved_question support
  improved_accuracy?: number;
  improved_correct?: number;
  improved_total?: number;
  // "Fixed" metrics - full results with improved questions replacing originals where available
  fixed_accuracy_by_type?: Record<QuestionType, { correct: number; total: number; accuracy: number }>;
  fixed_overall_accuracy?: number;
}

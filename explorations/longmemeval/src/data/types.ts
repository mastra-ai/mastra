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
  answer: string;
  question_date: string;
  haystack_session_ids: string[];
  haystack_dates: string[];
  haystack_sessions: Turn[][];
  answer_session_ids: string[];
}

export interface EvaluationResult {
  question_id: string;
  hypothesis: string;
  autoeval_label?: boolean;
  question_type?: QuestionType;
  is_correct?: boolean;
}

export type DatasetType = 'longmemeval_s' | 'longmemeval_m' | 'longmemeval_oracle';

export type MemoryConfigType =
  | 'semantic-recall'
  | 'working-memory'
  | 'working-memory-tailored'
  | 'combined'
  | 'combined-tailored';

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
}

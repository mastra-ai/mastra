import type { StorageColumn } from '../storage/types';
import type { RetryConfig } from './types';

export const TABLE_INBOX_TASKS = 'mastra_inbox_tasks';

export const INBOX_TASKS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  inbox_id: { type: 'text', nullable: false },
  type: { type: 'text', nullable: false },
  status: { type: 'text', nullable: false },
  priority: { type: 'integer', nullable: false },

  // Display
  title: { type: 'text', nullable: true },
  source_id: { type: 'text', nullable: true },
  source_url: { type: 'text', nullable: true },

  // Data
  payload: { type: 'jsonb', nullable: false },
  result: { type: 'jsonb', nullable: true },
  error: { type: 'jsonb', nullable: true },

  // Assignment
  target_agent_id: { type: 'text', nullable: true },
  claimed_by: { type: 'text', nullable: true },

  // Run association
  run_id: { type: 'text', nullable: true },

  // Timing
  created_at: { type: 'timestamp', nullable: false },
  claimed_at: { type: 'timestamp', nullable: true },
  claim_expires_at: { type: 'timestamp', nullable: true },
  started_at: { type: 'timestamp', nullable: true },
  completed_at: { type: 'timestamp', nullable: true },

  // Retries
  attempts: { type: 'integer', nullable: false },
  max_attempts: { type: 'integer', nullable: false },
  next_retry_at: { type: 'timestamp', nullable: true },

  // Human-in-the-loop
  suspended_at: { type: 'timestamp', nullable: true },
  suspend_payload: { type: 'jsonb', nullable: true },
  resume_payload: { type: 'jsonb', nullable: true },

  // Metadata
  metadata: { type: 'jsonb', nullable: true },
};

// Default values
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_PRIORITY = 1; // NORMAL
export const DEFAULT_CLAIM_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 3600000, // 1 hour
  multiplier: 2,
  jitter: true,
};

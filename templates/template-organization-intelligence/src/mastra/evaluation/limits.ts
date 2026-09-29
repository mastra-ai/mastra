export const MAX_EXPERIMENT_CASES = 30;
export const EVALUATION_STORE_NAME = 'organization-evaluation-experiments';
export const LEASE_DIRECTORY = '.organization-evaluation-run';
export const AGENT_DATASET_ID = 'organization-agent-evaluation';
export const RETRIEVAL_DATASET_ID = 'organization-retrieval-evaluation';
export const CALIBRATION_DATASET_ID = 'organization-judge-calibration';
export const GROUNDEDNESS_SCORER_ID = 'organization-groundedness';
export const RETRIEVAL_RECALL_SCORER_ID = 'organization-required-record-recall';
export const EVALUATION_PROVIDER_TIMEOUT_MS = 30_000;

export const EXPERIMENT_LIMITS = {
  maxCases: MAX_EXPERIMENT_CASES,
  concurrency: 1,
  maxRetries: 0,
  maxOutputTokens: 4_096,
} as const;

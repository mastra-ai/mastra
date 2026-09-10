export const LANGFUSE_OBSERVATION_FIELDS = [
  'core',
  'basic',
  'time',
  'io',
  'metadata',
  'model',
  'usage',
  'prompt',
  'metrics',
  'trace_context',
].join(',');

/**
 * The API accepts a comma-separated list of metadata keys. Langfuse v4 treats
 * `*` as a request for the non-truncated metadata row, which is required when
 * the source keys are not known before reading the observation.
 */
export const LANGFUSE_EXPAND_ALL_METADATA = '*';

/** Core fields are always present in an Observations API v2 response. */
export interface LangfuseObservation {
  id: string;
  traceId: string | null;
  startTime: string;
  endTime: string | null;
  projectId: string;
  parentObservationId: string | null;
  type: string;

  name?: string | null;
  level?: string | null;
  statusMessage?: string | null;
  version?: string | null;
  environment?: string | null;
  bookmarked?: boolean | null;
  public?: boolean | null;
  userId?: string | null;
  sessionId?: string | null;
  isRootObservation?: boolean | null;
  completionStartTime?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  input?: unknown;
  output?: unknown;
  metadata?: unknown;
  model?: string | null;
  providedModelName?: string | null;
  internalModelId?: string | null;
  modelId?: string | null;
  modelParameters?: unknown;
  usageDetails?: Record<string, number> | null;
  costDetails?: Record<string, number> | null;
  inputCost?: number | null;
  outputCost?: number | null;
  totalCost?: number | null;
  inputPrice?: string | null;
  outputPrice?: string | null;
  totalPrice?: string | null;
  usagePricingTierId?: string | null;
  usagePricingTierName?: string | null;
  promptId?: string | null;
  promptName?: string | null;
  promptVersion?: string | number | null;
  latency?: number | null;
  timeToFirstToken?: number | null;
  tags?: string[] | null;
  release?: string | null;
  traceName?: string | null;

  /** Preserve fields added by a newer Langfuse version for the mapper. */
  [field: string]: unknown;
}

export interface LangfuseObservationsPage {
  data: LangfuseObservation[];
  cursor: string | null;
}

export interface LangfuseProject {
  id: string;
  name: string | null;
}

export type LangfuseTraceDiscovery =
  | { kind: 'trace'; traceId: string }
  | { kind: 'missing-trace-id'; observationId: string };

export interface LangfuseSourceTrace {
  traceId: string;
  observations: LangfuseObservation[];
}

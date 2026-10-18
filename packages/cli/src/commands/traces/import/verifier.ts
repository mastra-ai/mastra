/** Lightweight stored fields used to verify an imported span without reading its payload. */
export interface TraceImportStoredSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  spanType: string;
  startedAt: string;
  endedAt: string | null;
  isEvent: boolean;
  error?: unknown;
}

export type TraceImportReadResult =
  | { kind: 'found'; spans: TraceImportStoredSpan[] }
  | { kind: 'pending' }
  | { kind: 'retryable'; reason: string; retryAfterMs?: number }
  | { kind: 'unavailable'; reason: string };

export interface TraceImportVerifierReadOptions {
  signal?: AbortSignal;
}

/** Provider-neutral read-back boundary used after all uploads are acknowledged. */
export interface TraceImportVerifier {
  readonly projectId: string;
  readTrace(traceId: string, options?: TraceImportVerifierReadOptions): Promise<TraceImportReadResult>;
}

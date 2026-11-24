import type { PreparedTraceBatch } from './types.js';

export interface TraceImportTargetUploadOptions {
  signal?: AbortSignal;
}

/** Provider-neutral destination used by the shared trace import pipeline. */
export interface TraceImportTarget {
  readonly projectId: string;
  upload(batch: PreparedTraceBatch, options?: TraceImportTargetUploadOptions): Promise<void>;
}

import { acknowledgeTraceBatch, readTraceImportManifest } from './manifest.js';
import { readPendingTraceBatches } from './prepared-traces.js';
import type { TraceImportTarget } from './target.js';
import type { TraceImportManifest } from './types.js';

export interface UploadTraceImportOptions {
  directory: string;
  target: TraceImportTarget;
  signal?: AbortSignal;
  batch?: {
    preferredSpansPerBatch?: number;
    maxPayloadBytes?: number;
  };
}

/** Upload every pending whole-trace batch and checkpoint only acknowledged work. */
export async function uploadTraceImport(options: UploadTraceImportOptions): Promise<TraceImportManifest> {
  let manifest = await readTraceImportManifest(options.directory);
  if (manifest.targetProjectId !== options.target.projectId) {
    throw new Error('Cannot upload prepared traces to a different target project.');
  }

  for await (const batch of readPendingTraceBatches(options.directory, {
    ...options.batch,
    signal: options.signal,
  })) {
    options.signal?.throwIfAborted();
    await options.target.upload(batch, { signal: options.signal });
    manifest = await acknowledgeTraceBatch(options.directory, batch);
  }

  return manifest;
}

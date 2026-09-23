import type { TraceImportRecord, TraceImportSourceIdentity, TraceImportWindow } from './types.js';

export interface TraceImportReadContext extends TraceImportWindow {
  source: TraceImportSourceIdentity;
  importId: string;
  signal?: AbortSignal;
  onRetry: () => void;
}

/**
 * Boundary between a source provider and the shared trace import pipeline.
 *
 * Implementations own authentication, pagination, source tree reconstruction,
 * source-specific validation, field mapping, and stable destination IDs. They
 * yield complete Mastra traces or an explicit skip reason.
 *
 * The shared importer owns common validation, preparation, batching, upload,
 * resume, verification, reporting, and cleanup. It must not import raw
 * provider types or contain provider-specific behavior.
 */
export interface TraceImportProvider {
  identify(signal?: AbortSignal): Promise<TraceImportSourceIdentity>;
  read(context: TraceImportReadContext): AsyncIterable<TraceImportRecord>;
}

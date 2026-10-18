import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TraceImportManifest, TraceImportReport } from './types.js';

export const TRACE_IMPORT_REPORT_FILE = 'report.json';

export function createTraceImportReport(directory: string, manifest: TraceImportManifest): TraceImportReport {
  return {
    importId: manifest.importId,
    stateDirectory: directory,
    provider: manifest.source.provider,
    sourceProjectId: manifest.source.projectId,
    targetProjectId: manifest.targetProjectId,
    window: manifest.window,
    phase: manifest.phase,
    counts: manifest.counts,
    acknowledgedTraces: manifest.acknowledgedTraces,
    acknowledgedSpans: manifest.acknowledgedSpans,
    verification: manifest.verification,
    warnings: manifest.warnings,
    skippedTraceSamples: manifest.skippedTraceSamples,
  };
}

/** Write a private, non-secret summary suitable for CLI output and support diagnostics. */
export async function writeTraceImportReport(
  directory: string,
  manifest: TraceImportManifest,
): Promise<TraceImportReport> {
  const report = createTraceImportReport(directory, manifest);
  await writeFile(join(directory, TRACE_IMPORT_REPORT_FILE), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  return report;
}

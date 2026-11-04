import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { Mastra } from '@mastra/core';
import { vendorRiskQuestionnaire } from '../src/mastra/workflows/vendor-risk-questionnaire.ts';
import { respond } from '../src/mastra/runtime/respond.ts';
import { loadEvidenceProfile } from '../src/mastra/runtime/profile.ts';
import {
  databaseUrl,
  runtimeRoot,
  storage,
  nativeStorage,
  storageOwner,
  telemetryHealth,
} from '../src/mastra/persistence/database.ts';
import { executeWithStorageOwner } from '../src/mastra/persistence/client.ts';
import { createLocalObservability, SafeLogger } from '../src/mastra/observability/privacy.ts';

const observability = createLocalObservability();
let terminal: ReturnType<typeof createInterface> | undefined;
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { resume: { type: 'string' } } });
  if ((values.resume && positionals.length) || (!values.resume && positionals.length !== 1))
    throw new Error('INVALID_RESPOND_ARGUMENTS');
  if (!process.stdin.isTTY) throw new Error('INTERACTIVE_REVIEW_REQUIRED');
  terminal = createInterface({ input: process.stdin, output: process.stdout });
  let closed = false;
  terminal.on('close', () => {
    closed = true;
  });
  const profile = await loadEvidenceProfile(runtimeRoot);
  await storage.init();
  new Mastra({ storage, logger: new SafeLogger(), observability, workflows: { vendorRiskQuestionnaire } });
  await executeWithStorageOwner(
    storageOwner,
    () => observability.flush(),
    () =>
      respond({
        databaseUrl,
        runtimeRoot,
        profile,
        workflow: vendorRiskQuestionnaire,
        sourcePath: positionals[0],
        resume: values.resume,
        io: {
          show: text => console.log(text),
          ask: async prompt => {
            if (closed) return null;
            let onClose: (() => void) | undefined;
            try {
              return await Promise.race([
                terminal!.question(prompt),
                new Promise<null>(resolve => {
                  onClose = () => resolve(null);
                  terminal!.once('close', onClose);
                }),
              ]);
            } catch {
              return null;
            } finally {
              if (onClose) terminal!.removeListener('close', onClose);
            }
          },
        },
      }),
  );
} catch (error) {
  const safeCodes = new Set([
    'OPERATOR_CANCELLED',
    'FINAL_APPROVAL_DECLINED',
    'INTERACTIVE_REVIEW_REQUIRED',
    'PREFILLED_REPLACEMENT_DECLINED',
    'UNSUPPORTED_INTAKE',
    'COMPLETION_NOT_INITIALIZED',
    'INVALID_RESPOND_ARGUMENTS',
    'MISSING_RESPONSE_TARGET',
    'RESPONSE_TARGET_REQUIRED',
    'PROTECTED_RESPONSE_TARGET',
    'MERGED_RESPONSE_TARGET',
    'FIXED_RESPONSE_LAYOUT',
    'AMBIGUOUS_RESPONSE_SPAN',
    'PREFILLED_REPLACEMENT_REQUIRED',
    'UNREPRESENTABLE_RESPONSE',
    'UNINSPECTABLE_PACKAGE_CONTENT',
    'RESTRICTED_ORIGINAL_CONTENT',
    'RETAINED_PACKAGE_SECURITY_BLOCKED',
    'STALE_SOURCE_MAPPING',
    'STALE_REVIEW',
    'RUN_NOT_FOUND',
    'DATABASE_WRITER_OWNED',
  ]);
  console.error(error instanceof Error && safeCodes.has(error.message) ? error.message : 'RESPOND_OPERATION_FAILED');
  if (error instanceof Error && error.message === 'DATABASE_WRITER_OWNED') {
    console.error('The local database is locked by another process. Stop npm run dev or any other writer, then retry.');
    console.error('respond runs Mastra directly and does not need the dev server.');
    console.error('If the previous process crashed, follow the writer recovery instructions in docs/review.md.');
  }
  process.exitCode = 1;
} finally {
  terminal?.close();
  let cleanupFailed = false;
  try {
    await observability.shutdown();
  } catch {
    cleanupFailed = true;
  }
  try {
    await nativeStorage.close();
  } catch {
    cleanupFailed = true;
  }
  if (cleanupFailed) {
    console.error('STORAGE_FAILURE');
    process.exitCode = 1;
  }
  if (telemetryHealth.status === 'degraded_incomplete') console.error('Telemetry degraded/incomplete.');
}

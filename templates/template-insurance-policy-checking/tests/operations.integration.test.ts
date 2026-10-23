import { expect, it } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { reportWire } from './report-provider.js';
import { evaluationCases } from './evaluation-cases.js';

it('operational_traces_correlate_without_exposing_documents', async () => {
  const root = await mkdtemp(join(tmpdir(), 'insurance-operations-'));
  const documents = structuredClone(evaluationCases[0]!.documents);
  documents[0]!.pages[3]!.push('SENTINEL_PRIVATE_DOCUMENT_TEXT');
  const wire = await reportWire(documents);
  const failed = await reportWire(documents, 'normal', { ...evaluationCases[0]!, documents, behavior: 'unavailable' });
  const invalid = await reportWire(documents, 'invalid-structured-target');
  const logs: string[] = [];
  try {
    for (const mode of ['create', 'revise', 'approve', 'failure', 'invalid-output']) {
      const result = await promisify(execFile)(
        process.execPath,
        [
          '--import',
          './tests/source-loader.mjs',
          './tests/operations-worker.mjs',
          JSON.stringify({
            mode,
            root: join(root, ['failure', 'invalid-output'].includes(mode) ? mode : 'case'),
            endpoint:
              mode === 'failure' ? failed.endpoint : mode === 'invalid-output' ? invalid.endpoint : wire.endpoint,
          }),
        ],
        {
          maxBuffer: 16 * 1024 * 1024,
          env: { ...process.env, OPENAI_API_KEY: 'SENTINEL_PRIVATE_CREDENTIAL', NODE_ENV: 'test' },
        },
      );
      logs.push(result.stdout, result.stderr);
    }
    const captured = logs.join('\n');
    expect(captured).toContain('insurance.operation');
    for (const stage of ['processing', 'draft', 'review', 'finalization', 'provider', 'startup'])
      expect(captured).toContain(`stage: '${stage}'`);
    for (const outcome of ['completed', 'revised', 'approved', 'failed', 'recovered'])
      expect(captured).toContain(`outcome: '${outcome}'`);
    expect(captured).toMatch(/caseId: '[a-f0-9-]{36}'/);
    expect(captured).toMatch(/runId: '[a-f0-9-]{36}'/);
    expect(captured).toContain('durationMs:');
    expect(captured).toContain('classifications:');
    expect(captured).toContain('costMicros: null');
    expect(captured).toContain("errorCode: 'MODEL_UNAVAILABLE'");
    expect(captured).toContain("errorCode: 'MODEL_INVALID_OUTPUT'");
    expect(captured).toContain("processingStage: 'extraction'");
    expect(captured).toContain("failurePhase: 'schema_validation'");
    expect(captured).toContain("finishReason: 'unknown'");
    expect(captured).toContain("nativeErrorKind: 'MastraError'");
    for (const secret of [
      'SENTINEL_PRIVATE',
      'data:application/pdf',
      'Elm Harbor',
      'Cedar Lane',
      'Maya Chen',
      'Harbor Mutual',
      'Escape of water',
      'approvalStatement',
      'authorization',
      'Bearer',
      'API key',
    ])
      expect(captured).not.toContain(secret);
    await mkdir(resolve('.runtime/evaluation'), { recursive: true });
    await writeFile(resolve('.runtime/evaluation/operations.log'), captured);
  } finally {
    await wire.close();
    await failed.close();
    await invalid.close();
    await rm(root, { recursive: true, force: true });
  }
});

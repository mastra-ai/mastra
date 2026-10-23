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
  const incomplete = await reportWire(documents, 'incomplete');
  const interrupted = await reportWire(documents, 'interrupted');
  const grounding = await reportWire(documents, 'invalid-grounding-parallel');
  const logs: string[] = [];
  let invalidLogs = '';
  let groundingLogs = '';
  try {
    for (const mode of [
      'create',
      'revise',
      'approve',
      'failure',
      'invalid-output',
      'incomplete',
      'interrupted',
      'grounding',
    ]) {
      const result = await promisify(execFile)(
        process.execPath,
        [
          '--import',
          './tests/source-loader.mjs',
          './tests/operations-worker.mjs',
          JSON.stringify({
            mode,
            root: join(
              root,
              ['failure', 'invalid-output', 'incomplete', 'interrupted', 'grounding'].includes(mode) ? mode : 'case',
            ),
            endpoint:
              mode === 'failure'
                ? failed.endpoint
                : mode === 'invalid-output'
                  ? invalid.endpoint
                  : mode === 'incomplete'
                    ? incomplete.endpoint
                    : mode === 'interrupted'
                      ? interrupted.endpoint
                      : mode === 'grounding'
                        ? grounding.endpoint
                        : wire.endpoint,
          }),
        ],
        {
          maxBuffer: 16 * 1024 * 1024,
          env: { ...process.env, OPENAI_API_KEY: 'SENTINEL_PRIVATE_CREDENTIAL', NODE_ENV: 'test' },
        },
      );
      logs.push(result.stdout, result.stderr);
      if (mode === 'invalid-output') invalidLogs = result.stdout + result.stderr;
      if (mode === 'grounding') groundingLogs = result.stdout + result.stderr;
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
    expect(captured).toContain("nativeErrorCode: 'STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED'");
    expect(captured).toContain("code: 'custom'");
    expect(captured).toMatch(/sourceId: '[a-f0-9-]{36}'/);
    expect(captured).toMatch(/reservationId: '[a-f0-9-]{36}'/);
    expect(captured).toContain("failurePhase: 'transport_interruption'");
    expect(captured).toContain("errorCode: 'MODEL_REQUEST_INTERRUPTED'");
    const invalidSources = invalid.requests.map(request => {
      const input = (request as { input: { role: string; content: { text: string }[] }[] }).input;
      return JSON.parse(
        input
          .find(item => item.role === 'user')!
          .content.map(item => item.text)
          .join(''),
      ).data.source;
    });
    const rejectedSource = invalidSources.find(source => source.displayName === documents[1]!.name)!;
    const schemaFailures = (invalidLogs.match(/insurance\.operation \{[\s\S]*?\n\}/g) ?? []).filter(event =>
      event.includes("nativeErrorCode: 'STRUCTURED_OUTPUT_SCHEMA_VALIDATION_FAILED'"),
    );
    expect(schemaFailures).toHaveLength(1);
    expect(schemaFailures[0]).toContain(`sourceId: '${rejectedSource.sourceId}'`);
    expect(invalidSources).toHaveLength(3);
    const groundingEvents = (groundingLogs.match(/insurance\.operation \{[\s\S]*?\n\}/g) ?? []).filter(event =>
      event.includes("failurePhase: 'evidence_validation'"),
    );
    expect(groundingEvents).toHaveLength(2);
    const groundingSources = grounding.requests.map(request => {
      const input = (request as { input: { role: string; content: { text: string }[] }[] }).input;
      return JSON.parse(
        input
          .find(item => item.role === 'user')!
          .content.map(item => item.text)
          .join(''),
      ).data.source;
    });
    for (const [document, reason, path] of [
      [documents[0]!, 'excerpt_not_exact', "'terms', 0, 'evidence', 0, 'excerpt'"],
      [documents[1]!, 'original_not_in_excerpt', "'terms', 0, 'original'"],
    ] as const) {
      const source = groundingSources.find(source => source.displayName === document.name)!;
      const event = groundingEvents.find(event => event.includes(`sourceId: '${source.sourceId}'`))!;
      expect(event).toContain(`reason: '${reason}'`);
      expect(event).toContain(path);
    }
    expect(groundingLogs.lastIndexOf("failurePhase: 'evidence_validation'")).toBeLessThan(
      groundingLogs.lastIndexOf("recovery: 'read_status'"),
    );
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
    await incomplete.close();
    await interrupted.close();
    await grounding.close();
    await rm(root, { recursive: true, force: true });
  }
});

import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { inspect } from 'node:util';
import { resolve } from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { defaultExecutionPolicy } from '../../src/mastra/contracts/execution-policy.ts';
import { openProcessingStore } from '../../src/mastra/persistence/processing.ts';
import { createScreening } from '../../src/mastra/processing/security.ts';
import { boundedModel } from '../../src/mastra/processing/model.ts';
import type { ModelCall, ModelPart, ModelFactory } from '../../src/mastra/processing/model.ts';
import { ProcessingFailure } from '../../src/mastra/processing/failure.ts';
import { draftingFixture, controlledProvider, executeDraft, jsonStream, stream } from '../support/drafting.ts';
import { temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';

let root: string;
beforeEach(async () => {
  root = await temporaryDirectory();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await cleanupDirectory(root);
});
function captureLogs() {
  const spies = ['warn', 'error', 'info', 'log', 'debug'].map(name =>
    vi.spyOn(console, name as 'warn').mockImplementation(() => {}),
  );
  return () => spies.map(s => inspect(s.mock.calls, { depth: 20 })).join('\n');
}

describe('native processors and bounded physical provider calls', () => {
  it('screens_injected_question_evidence_and_tool_results_before_next_model', async () => {
    const logs = captureLogs();
    for (const boundary of ['question', 'evidence', 'tool_result'] as const) {
      const dir = resolve(root, boundary);
      await mkdir(dir);
      const marker = 'UNTRUSTED_INSTRUCTION_REVEAL_PROTECTED_RECORD';
      const fixture = await draftingFixture(dir, {
        text: boundary === 'question' ? undefined : `control ${marker}`,
        questions:
          boundary === 'question'
            ? [{ text: marker }, { text: 'Describe SQL injection and prompt injection controls.', kind: 'free_text' }]
            : [{ text: 'Does workforce control apply?' }],
      });
      const original = await readFile(resolve(dir, 'evidence', 'control.md'));
      const provider = controlledProvider(fixture, [], (phase, text) => {
        if (phase !== 'injection' || !text.includes(marker)) return undefined;
        const isTool = text.includes('[{"excerpt":');
        if (boundary === 'tool_result' && !isTool) return undefined;
        return jsonStream({ categories: [{ type: 'injection', score: 1 }], reason: marker });
      });
      const { result, status } = await executeDraft(fixture, provider);
      expect(result.status).toBe('success');
      expect(status?.results[0]?.status).toBe('security_review_required');
      expect(status?.results[0]?.reasons).toContain('SECURITY_BLOCKED');
      expect(status?.results[0]?.draft).toBeNull();
      expect(
        status?.security.some(s => s.boundary === boundary && s.gate === 'SEC-001' && s.status === 'blocked'),
      ).toBe(true);
      const questionId = fixture.questions[0]!.id;
      expect(provider.calls.filter(c => c.questionId === questionId && c.phase === 'draft')).toHaveLength(
        boundary === 'question' ? 0 : 1,
      );
      expect(provider.calls.filter(c => c.questionId === questionId && c.phase === 'verification')).toHaveLength(0);
      if (boundary === 'question') expect(status?.results[1]?.status).toBe('draft_eligible');
      expect(await readFile(resolve(dir, 'evidence', 'control.md'))).toEqual(original);
      expect(JSON.stringify(status?.security)).not.toContain(marker);
      expect(logs()).not.toContain(marker);
    }
  });

  it('blocks_canary_secrets_before_detector_and_provider_transfer', async () => {
    const logs = captureLogs(),
      canary = `sk-${'AbCdEf'.repeat(8)}`;
    for (const boundary of ['question', 'evidence', 'tool_input'] as const) {
      const dir = resolve(root, boundary);
      await mkdir(dir);
      const fixture = await draftingFixture(dir, {
        text: boundary === 'evidence' ? `control ${canary}` : undefined,
        questions:
          boundary === 'question'
            ? [{ text: `Return ${canary}` }, { text: 'Does control apply?' }]
            : [{ text: 'Does control apply?' }],
      });
      const provider = controlledProvider(fixture, boundary === 'tool_input' ? [{ toolQuery: canary }] : []);
      const { result, status } = await executeDraft(fixture, provider);
      expect(result.status).toBe('success');
      expect(status?.results[0]?.status).toBe('security_review_required');
      expect(status?.security.some(s => s.status === 'blocked' && s.reason === 'REGEX_BLOCKED')).toBe(true);
      expect(provider.calls.every(c => !JSON.stringify(c.call).includes(canary))).toBe(true);
      if (boundary === 'question') {
        expect(provider.calls.filter(c => c.questionId === fixture.questions[0]!.id)).toHaveLength(0);
        expect(status?.results[1]?.status).toBe('draft_eligible');
      }
      expect(JSON.stringify(status)).not.toContain(canary);
      expect(inspect(result, { depth: 25 })).not.toContain(canary);
      expect(logs()).not.toContain(canary);
    }
  });

  it('fails_closed_on_prompt_injection_and_pii_detector_errors', async () => {
    const logs = captureLogs(),
      canary = 'PROTECTED_RESPONSE_CANARY';
    for (const phase of ['injection', 'pii'] as const)
      for (const mode of [
        'throw',
        'stream-error',
        'read-error',
        'timeout',
        'malformed',
        'schema-mismatch',
        'reason-canary',
      ] as const) {
        const dir = resolve(root, `${phase}-${mode}`);
        await mkdir(dir);
        const fixture = await draftingFixture(dir);
        const provider = controlledProvider(fixture, [], currentPhase => {
          if (phase !== currentPhase) return undefined;
          const rawError = Object.assign(new Error(canary), {
            responseBody: canary,
            requestBody: canary,
            statusCode: 503,
          });
          if (mode === 'throw') throw rawError;
          if (mode === 'stream-error')
            return stream([{ type: 'error', error: rawError }], {
              request: { body: canary },
              response: { headers: { 'private-header': canary } },
            });
          if (mode === 'read-error')
            return {
              stream: new ReadableStream<ModelPart>({
                start(c) {
                  c.error(rawError);
                },
              }),
              request: { body: canary },
            };
          if (mode === 'timeout') return { stream: new ReadableStream<ModelPart>() };
          if (mode === 'malformed') return jsonStream(`{ invalid ${canary}`);
          if (mode === 'schema-mismatch')
            return jsonStream({ categories: [{ type: canary, score: 2 }], reason: canary, detections: canary });
          return jsonStream(
            phase === 'injection'
              ? { categories: [{ type: 'injection', score: 1 }], reason: canary }
              : {
                  categories: [{ type: 'name', score: 1 }],
                  detections: [{ type: 'name', value: canary, confidence: 1, start: 0, end: 1 }],
                },
          );
        });
        const { result, status } = await executeDraft(fixture, provider, { callTimeoutMs: 30 });
        expect(result.status).toBe('success');
        expect(status?.results[0]?.status).toBe('security_review_required');
        expect(status?.results[0]?.reasons).toContain(
          mode === 'reason-canary' ? 'SECURITY_BLOCKED' : 'DETECTOR_FAILED',
        );
        expect(status?.results[0]?.draft).toBeNull();
        expect(
          provider.calls.filter(c => c.phase === 'interpretation' || c.phase === 'draft' || c.phase === 'verification'),
        ).toHaveLength(0);
        expect(status?.security.at(-1)?.status).toBe(mode === 'reason-canary' ? 'blocked' : 'failed');
        expect(provider.calls.filter(c => c.phase === phase).length).toBeGreaterThan(0);
        expect(provider.calls.filter(c => c.phase === phase).length).toBeLessThanOrEqual(6);
        expect(status?.usage.length).toBe(provider.calls.length);
        expect(JSON.stringify(status)).not.toContain(canary);
        expect(inspect(result, { depth: 25 })).not.toContain(canary);
        expect(logs()).not.toContain(canary);
        if (mode === 'throw' || mode === 'stream-error' || mode === 'read-error' || mode === 'timeout')
          expect(status?.usage.some(u => u.status === 'uncertain' && u.estimatedUsd > 0)).toBe(true);
      }
    // Unsupported requested JSON schemas fail before transfer through the public wrapper.
    const dir = resolve(root, 'unsupported-schema');
    await mkdir(dir);
    const fixture = await draftingFixture(dir),
      provider = controlledProvider(fixture),
      store = await openProcessingStore(fixture.url);
    try {
      await store.begin(fixture.runId, defaultExecutionPolicy);
      const model = boundedModel({
        runId: fixture.runId,
        questionId: fixture.questions[0]!.id,
        phase: 'injection',
        policy: defaultExecutionPolicy,
        store,
        provider: provider.factory('injection', fixture.questions[0]!.id),
        maxTurns: 1,
      });
      const call = {
        prompt: [],
        responseFormat: { type: 'json', schema: { type: 'unsupported' } },
      } as unknown as ModelCall;
      await expect(model.doStream(call)).rejects.toMatchObject({ code: 'INVALID_MODEL_OUTPUT' });
      expect(provider.calls).toHaveLength(0);
      expect(logs()).not.toContain(canary);
    } finally {
      store.close();
    }
  }, 30000);

  it('counts_internal_guard_calls_and_stops_at_shared_budget', async () => {
    const logs = captureLogs();
    const fixture = await draftingFixture(root),
      store = await openProcessingStore(fixture.url);
    const policy = { ...defaultExecutionPolicy, maxPhysicalCalls: 3 };
    const provider = controlledProvider(fixture, [], phase =>
      jsonStream(
        phase === 'injection' ? { categories: null, reason: null } : { categories: null, detections: null },
        true,
      ),
    );
    try {
      await store.begin(fixture.runId, policy);
      const screen = createScreening({
        runId: fixture.runId,
        questionId: fixture.questions[0]!.id,
        policy,
        store,
        models: provider.factory,
      });
      await screen('Describe benign SQL and prompt injection controls.', 'question');
      await expect(screen('Approved benign evidence content.', 'evidence')).rejects.toMatchObject({
        code: 'BUDGET_EXHAUSTED',
      });
      const status = await store.status(fixture.runId);
      expect(provider.calls.map(c => c.phase)).toEqual(['injection', 'pii', 'injection']);
      expect(status?.usage).toHaveLength(3);
      expect(
        status?.usage.every(
          u =>
            u.status === 'uncertain' && u.inputTokens === null && u.outputTokens === null && u.estimatedUsd === 0.056,
        ),
      ).toBe(true);
      expect(status?.run.stopReason).toBe('BUDGET_EXHAUSTED');
      expect(status?.security.at(-1)?.reason).toBe('DETECTOR_FAILED');
      await expect(screen('No more calls are allowed.', 'draft')).rejects.toMatchObject({ code: 'BUDGET_EXHAUSTED' });
      expect(provider.calls).toHaveLength(3);
    } finally {
      store.close();
    }
    const reopened = await openProcessingStore(fixture.url);
    try {
      const status = await reopened.status(fixture.runId);
      expect(status?.usage).toHaveLength(3);
      const reservation = await reopened.reserve(fixture.runId, fixture.questions[0]!.id, 'draft', 1, 8000);
      expect(reservation).toEqual({ failure: 'BUDGET_EXHAUSTED' });
    } finally {
      reopened.close();
    }
    expect(logs()).not.toContain('Approved benign evidence content.');
  });

  it('drops_provider_metadata_warnings_and_reasoning_before_native_consumption', async () => {
    const logs = captureLogs(),
      canary = 'PROTECTED_METADATA_CANARY';
    const fixture = await draftingFixture(root);
    const provider = controlledProvider(fixture, [], phase => {
      const clean = jsonStream(
        phase === 'injection' ? { categories: null, reason: null } : { categories: null, detections: null },
      );
      return {
        ...clean,
        stream: new ReadableStream<ModelPart>({
          async start(c) {
            c.enqueue({ type: 'stream-start', warnings: [{ type: 'other', message: canary }] });
            c.enqueue({ type: 'reasoning-start', id: 'reasoning' });
            c.enqueue({ type: 'reasoning-delta', id: 'reasoning', delta: canary });
            c.enqueue({ type: 'reasoning-end', id: 'reasoning' });
            c.enqueue({ type: 'raw', rawValue: canary });
            c.enqueue({ type: 'response-metadata', id: canary, modelId: canary });
            for await (const part of clean.stream)
              c.enqueue(
                part.type === 'text-start' || part.type === 'text-end' || part.type === 'text-delta'
                  ? { ...part, id: canary.repeat(100) }
                  : part,
              );
            c.close();
          },
        }),
        request: { body: canary },
        response: { headers: { 'private-header': canary } },
      };
    });
    const { result, status } = await executeDraft(fixture, provider);
    expect(status?.results[0]?.status).toBe('draft_eligible');
    expect(status?.usage.some(u => u.reasoningTokens === 20)).toBe(true);
    expect(JSON.stringify(status)).not.toContain(canary);
    expect(inspect(result, { depth: 25 })).not.toContain(canary);
    expect(logs()).not.toContain(canary);
  });

  it('enforces_reported_token_limits_and_stops_after_storage_authority_failure', async () => {
    captureLogs();
    const fixture = await draftingFixture(root),
      store = await openProcessingStore(fixture.url);
    await store.begin(fixture.runId, defaultExecutionPolicy);
    let transfers = 0;
    const models: ModelFactory = () => {
      const doStream = async () => {
        transfers++;
        return stream([
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: '{}' },
          { type: 'text-end', id: 't' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 100, outputTokens: 3000, totalTokens: 5100, reasoningTokens: 2000 },
          },
        ]);
      };
      return { doStream, doGenerate: doStream };
    };
    const model = boundedModel({
      runId: fixture.runId,
      questionId: fixture.questions[0]!.id,
      phase: 'injection',
      policy: defaultExecutionPolicy,
      store,
      provider: models('injection', fixture.questions[0]!.id),
      maxTurns: 3,
    });
    const call: ModelCall = { prompt: [], responseFormat: { type: 'json', schema: { type: 'object' } } };
    await expect(model.doStream(call)).rejects.toMatchObject({ code: 'TOKEN_LIMIT' });
    expect((await store.status(fixture.runId))?.run.stopReason).toBe('TOKEN_LIMIT');
    expect((await store.status(fixture.runId))?.usage[0]?.outputTokens).toBe(5000);
    await expect(model.doStream(call)).rejects.toMatchObject({ code: 'TOKEN_LIMIT' });
    expect(transfers).toBe(1);
    store.close();
    await expect(model.doStream(call)).rejects.toBeInstanceOf(ProcessingFailure);
    expect(transfers).toBe(1);
  });

  it('bounds_protocol_parts_and_keeps_malformed_usage_conservative', async () => {
    const logs = captureLogs(),
      canary = 'PROTECTED_PROTOCOL_ID_CANARY';
    for (const mode of ['part-flood', 'malformed-usage'] as const) {
      const dir = resolve(root, mode);
      await mkdir(dir);
      const fixture = await draftingFixture(dir),
        store = await openProcessingStore(fixture.url);
      let transfers = 0;
      try {
        await store.begin(fixture.runId, defaultExecutionPolicy);
        const doStream = async () => {
          transfers++;
          return stream(
            mode === 'part-flood'
              ? Array.from({ length: 8001 }, () => ({ type: 'text-start' as const, id: canary.repeat(100) }))
              : [
                  { type: 'text-start', id: canary },
                  { type: 'text-delta', id: canary, delta: '{}' },
                  { type: 'text-end', id: canary },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: Number.NaN, outputTokens: 100, totalTokens: undefined },
                  },
                ],
          );
        };
        const model = boundedModel({
          runId: fixture.runId,
          questionId: fixture.questions[0]!.id,
          phase: 'injection',
          policy: defaultExecutionPolicy,
          store,
          provider: { doStream, doGenerate: doStream },
          maxTurns: 2,
        });
        const call: ModelCall = { prompt: [], responseFormat: { type: 'json', schema: { type: 'object' } } };
        if (mode === 'part-flood') {
          await expect(model.doStream(call)).rejects.toMatchObject({ code: 'TOKEN_LIMIT' });
          await expect(model.doStream(call)).rejects.toMatchObject({ code: 'TOKEN_LIMIT' });
          expect((await store.status(fixture.runId))?.run.stopReason).toBe('TOKEN_LIMIT');
        } else {
          const response = await model.doStream(call),
            parts: ModelPart[] = [];
          for await (const part of response.stream) parts.push(part);
          expect(JSON.stringify(parts)).not.toContain(canary);
          expect(parts.at(-1)).toMatchObject({
            type: 'finish',
            usage: { inputTokens: undefined, outputTokens: undefined },
          });
        }
        expect(transfers).toBe(1);
        expect((await store.status(fixture.runId))?.usage[0]).toMatchObject({
          status: 'uncertain',
          inputTokens: null,
          outputTokens: null,
          estimatedUsd: 0.056,
        });
        expect(logs()).not.toContain(canary);
      } finally {
        store.close();
      }
    }
  });
});

import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { draftingFixture, controlledProvider, executeDraft, jsonStream, stream } from '../support/drafting.ts';
import { temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';
import { reviewFixture, decision } from '../support/review.ts';
import { submitReview } from '../../src/mastra/review/service.ts';
import { boundedModel } from '../../src/mastra/processing/model.ts';
import type { ModelCall } from '../../src/mastra/processing/model.ts';
import { defaultExecutionPolicy } from '../../src/mastra/contracts/execution-policy.ts';
import { openProcessingStore } from '../../src/mastra/persistence/processing.ts';
import { openDatabase } from '../../src/mastra/persistence/database.ts';

let root: string;
beforeEach(async () => {
  root = await temporaryDirectory();
});
afterEach(async () => {
  await cleanupDirectory(root);
});

it.each(['blocked', 'failed'] as const)('keeps unscreened equivalent answers after a %s comparison', async mode => {
  const f = await draftingFixture(root, {
    questions: Array.from({ length: 4 }, (_, i) => ({
      text: `Production logs retention question ${i + 1}?`,
      kind: 'free_text',
    })),
  });
  let comparisons = 0;
  const provider = controlledProvider(
    f,
    Array.from({ length: 4 }, () => ({
      value: 'free_text',
      interpretation: { equivalenceKey: 'retention' },
    })),
    (phase, text) => {
      if (phase !== 'injection' || !text.includes('"answers":[')) return;
      if (++comparisons !== 1) return;
      if (mode === 'failed') throw new Error('detector unavailable');
      return jsonStream({ categories: [{ type: 'injection', score: 1 }], reason: 'blocked comparison' });
    },
  );
  const { status } = await executeDraft(f, provider);
  expect(status!.results.slice(0, 2).every(r => r.status === 'security_review_required' && r.draft === null)).toBe(
    true,
  );
  expect(status!.results.slice(2).every(r => r.status === 'draft_eligible' && r.draft !== null)).toBe(true);
  expect(comparisons).toBe(2);
  expect(
    provider.calls.filter(c => c.phase === 'verification' && c.questionId.startsWith('consistency-')),
  ).toHaveLength(1);
  const store = await openProcessingStore(f.url);
  try {
    expect((await store.status(f.runId))!.results).toEqual(status!.results);
  } finally {
    store.close();
  }
});

it('persists an unknown answer without drafting or screening a discarded draft when retrieval is empty', async () => {
  const f = await draftingFixture(root, { denied: true, text: '' });
  const provider = controlledProvider(f);
  const { status } = await executeDraft(f, provider);
  expect(status!.results[0]).toMatchObject({
    status: 'review_required',
    reasons: ['MISSING_EVIDENCE', 'SOURCE_UNAVAILABLE'],
    draft: { value: 'unknown', limitations: ['No supporting evidence was returned.'] },
  });
  expect(provider.calls.some(c => c.phase === 'draft' || c.phase === 'verification')).toBe(false);
  expect(status!.security.some(s => s.boundary === 'draft')).toBe(false);
  expect(status!.usage).toHaveLength(provider.calls.length);
});

it('uses trusted gaps immediately when the remaining budget cannot reserve a full input and output', async () => {
  const f = await reviewFixture(root);
  try {
    const db = await openDatabase(f.url);
    const usage = f.status.usage[0]!;
    const spentElsewhere = f.status.usage.slice(1).reduce((sum, u) => sum + u.estimatedUsd, 0);
    const policy = f.status.run.policy;
    const outputCost = (policy.maxOutputTokens * policy.rates.outputUsdPerMillion) / 1e6;
    const inputCost = (policy.maxInputTokens * policy.rates.inputUsdPerMillion) / 1e6;
    const remaining = outputCost + inputCost / 2;
    try {
      await db.execute({
        sql: 'UPDATE vrq_usage SET usage_json=? WHERE id=?',
        args: [JSON.stringify({ ...usage, estimatedUsd: policy.budgetUsd - spentElsewhere - remaining }), usage.id],
      });
    } finally {
      db.close();
    }
    const calls = f.provider.calls.length;
    const result = await submitReview(
      decision(f, {
        dispositions: f.status.results.map(r => ({
          questionId: r.questionId,
          disposition: 'unknown',
          safeReason: 'No releasable supported answer is available.',
          releaseDocumentIds: [],
        })),
      }),
      f.options,
    );
    expect(result!.state).toBe('approved');
    expect(f.provider.calls).toHaveLength(calls);
  } finally {
    await f.mastra.shutdown();
  }
});

it('separates byte guards from token usage and keeps oversized calls local', async () => {
  for (const mode of ['valid-large', 'input-bytes', 'output-bytes', 'reported-input', 'reported-output'] as const) {
    const dir = resolve(root, mode);
    await mkdir(dir);
    const f = await draftingFixture(dir);
    const store = await openProcessingStore(f.url);
    try {
      await store.begin(f.runId, defaultExecutionPolicy);
      let calls = 0;
      const doStream = async () => {
        calls++;
        if (mode.startsWith('reported'))
          return stream([
            { type: 'text-delta', id: 'text', delta: '{}' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: {
                inputTokens: mode === 'reported-input' ? 8001 : 100,
                outputTokens: mode === 'reported-output' ? 4001 : 100,
                totalTokens: mode === 'reported-input' ? 8101 : 4101,
              },
            },
          ]);
        return jsonStream({ text: 'a'.repeat(mode === 'output-bytes' ? 16001 : 5000) });
      };
      const model = boundedModel({
        runId: f.runId,
        questionId: 'Q1',
        phase: 'draft',
        policy: defaultExecutionPolicy,
        store,
        provider: { doStream, doGenerate: doStream },
        maxTurns: 1,
      });
      const call: ModelCall = {
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'a'.repeat(mode === 'input-bytes' ? 32001 : 9000) }] },
        ],
        responseFormat: { type: 'json', schema: { type: 'object', properties: { text: { type: 'string' } } } },
      };
      if (mode === 'valid-large') {
        const response = await model.doStream(call);
        let output = '';
        for await (const part of response.stream) if (part.type === 'text-delta') output += part.delta;
        expect(JSON.parse(output).text).toHaveLength(5000);
      } else await expect(model.doStream(call)).rejects.toMatchObject({ code: 'TOKEN_LIMIT' });
      expect(calls).toBe(mode === 'input-bytes' ? 0 : 1);
      expect((await store.status(f.runId))!.run.stopReason).toBeNull();
      const next = boundedModel({
        runId: f.runId,
        questionId: 'Q2',
        phase: 'draft',
        policy: defaultExecutionPolicy,
        store,
        provider: {
          doStream: async () => jsonStream({ text: 'ok' }),
          doGenerate: async () => jsonStream({ text: 'ok' }),
        },
        maxTurns: 1,
      });
      await expect(next.doStream({ ...call, prompt: [] })).resolves.toHaveProperty('stream');
      const status = (await store.status(f.runId))!;
      expect(status.usage.at(-1)).toMatchObject({ questionId: 'Q2', status: 'observed', reason: null });
      if (mode.startsWith('reported'))
        expect(status.usage[0]).toMatchObject({ status: 'observed', reason: 'TOKEN_LIMIT' });
    } finally {
      store.close();
    }
  }
});

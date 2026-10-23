import { it, expect, vi } from 'vitest';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { draftingFixture, controlledProvider, executeDraft, userText, jsonStream } from '../support/drafting.ts';
import { v3Factory } from '../support/model-protocol.ts';
import { temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';
import { defaultExecutionPolicy } from '../../src/mastra/contracts/execution-policy.ts';
import { openProcessingStore } from '../../src/mastra/persistence/processing.ts';
import { attachDraftWorkflow } from '../support/workflow.ts';

it('rejects_v3_failed_finishes_in_public_workflow', async () => {
  const root = await temporaryDirectory();
  try {
    for (const reason of ['length', 'error', 'content-filter', 'unknown', 'other', 'bogus'] as const) {
      const dir = resolve(root, reason);
      await mkdir(dir);
      const f = await draftingFixture(dir),
        provider = controlledProvider(f);
      const factory = v3Factory(provider.factory, phase => (phase === 'draft' ? { reason } : undefined));
      const { status } = await executeDraft(f, { ...provider, factory });
      expect(status?.results[0]?.status).toBe('review_required');
      expect(status?.results[0]?.draft).toBeNull();
      const failed = status!.usage.find(u => u.phase === 'draft')!;
      expect(failed.reason).toBe('INVALID_MODEL_OUTPUT');
      expect(failed.status).toBe('observed');
      expect(JSON.stringify(status)).not.toContain('PRIVATE_');
    }
  } finally {
    await cleanupDirectory(root);
  }
}, 60000);

it('classifies_multiple_conservative_batches_without_omissions_or_duplicate_acceptance', async () => {
  const root = await temporaryDirectory();
  try {
    for (const mode of ['complete', 'duplicate', 'omitted'] as const) {
      const dir = resolve(root, mode);
      await mkdir(dir);
      const f = await draftingFixture(dir, {
          questions: Array.from({ length: 6 }, (_, i) => ({
            text: `Does workforce MFA apply to administrative account ${i + 1}?`,
          })),
        }),
        provider = controlledProvider(f);
      const batches: string[][] = [];
      const factory = v3Factory((phase, id) => {
        const base = provider.factory(phase, id);
        const call: typeof base.doStream = async options => {
          if (phase !== 'interpretation') return base.doStream(options);
          const request = JSON.parse(userText(options));
          const ids = request.questions.map((q: { id: string }) => q.id);
          batches.push(ids);
          const response = await base.doStream(options);
          if (mode === 'complete') return response;
          let text = '';
          for await (const part of response.stream) if (part.type === 'text-delta') text += part.delta;
          const result = JSON.parse(text);
          const keys = Object.keys(result.interpretations);
          delete result.interpretations[keys.at(-1)!];
          if (mode === 'duplicate') result.interpretations['unauthorized-question'] = result.interpretations[keys[0]!];
          return jsonStream(result);
        };
        return { doStream: call, doGenerate: call };
      });
      const { status } = await executeDraft(f, { ...provider, factory }, {});
      expect(batches).toHaveLength(3);
      expect(batches.every(b => b.length === 2)).toBe(true);
      expect(batches.flat()).toEqual(f.questions.map(q => q.id));
      expect(status?.results.map(r => r.questionId)).toEqual(f.questions.map(q => q.id));
      if (mode === 'complete') expect(status?.results.every(r => r.status === 'draft_eligible')).toBe(true);
      else {
        expect(status?.results.every(r => r.reasons.includes('INVALID_MODEL_OUTPUT') && r.draft === null)).toBe(true);
        expect(provider.calls.some(c => c.phase === 'draft')).toBe(false);
      }
    }
  } finally {
    await cleanupDirectory(root);
  }
}, 60000);

it('flushes_native_local_exporter_before_closing_live_fixture_storage', async () => {
  const root = await temporaryDirectory();
  const logs: unknown[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...args) => {
    logs.push(args);
  });
  try {
    const f = await draftingFixture(root, {
        questions: [{ text: 'Is MFA required for workforce administrative accounts?' }],
        text: 'control MFA is required for workforce administrative accounts.',
      }),
      provider = controlledProvider(f);
    const attached = await attachDraftWorkflow(f.url, f.runtimeRoot, v3Factory(provider.factory));
    try {
      const result = await (
        await attached.target.createRun()
      ).start({
        inputData: {
          runId: f.runId,
          evidenceRoot: resolve(root, 'evidence'),
          manifestPath: f.manifestPath,
          policy: defaultExecutionPolicy,
        },
      });
      expect(result.status).toBe('success');
      const store = await openProcessingStore(f.url);
      try {
        const status = (await store.status(f.runId))!;
        expect(status.results[0]?.status).toBe('draft_eligible');
        expect(status.usage.every(u => u.status === 'observed')).toBe(true);
      } finally {
        store.close();
      }
    } finally {
      await attached.close();
    }
    expect(JSON.stringify(logs)).not.toContain('CLIENT_CLOSED');
    expect(JSON.stringify(logs)).not.toContain('PRIVATE_');
  } finally {
    spy.mockRestore();
    await cleanupDirectory(root);
  }
}, 60000);

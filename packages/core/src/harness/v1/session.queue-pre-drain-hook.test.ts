/**
 * Harness v1 — `sessions.onBeforeQueuedTurn` pre-drain hook (§4.2e ordering).
 *
 * The hook runs once per queued item inside `_runQueuedTurn`, after the
 * admission receipt's terminal checks and before the turn's permission
 * rule/grant snapshot is captured. It exists so integrations can converge
 * durable authorization state (e.g. owner-scoped grant stores) onto the live
 * session record in the window between queue admission and queued-turn
 * execution.
 *
 * Covers:
 *   - ordering: grant mutations made inside the hook are what the turn's
 *     permission snapshot sees (grant → tool runs, revoke → tool asks)
 *   - invocation: receives `{ session, item }`, fires once per drain attempt,
 *     never for `message()` turns or completed receipts
 *   - fail-closed semantics: `HarnessQueuedTurnDeferredError` parks the item
 *     for retry without consuming the receipt's attempt budget; any other
 *     error fails the item permanently through the normal queue path
 *   - absent hook: drain behavior unchanged
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Agent } from '../../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '../../agent/__tests__/mock-model';
import { InMemoryStore } from '../../storage';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { createTool } from '../../tools';

import { HarnessQueuedTurnDeferredError } from './errors';
import type { HarnessEvent } from './events';
import { Harness } from './harness';
import type { HarnessConfig, HarnessMode, PermissionPolicy } from './types';

const testUsage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

function textStream(deltas: string[]) {
  return convertArrayToReadableStream([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'id-text', modelId: 'mock-model-id', timestamp: new Date(0) },
    { type: 'text-start', id: 'text-1' },
    ...deltas.map(delta => ({ type: 'text-delta', id: 'text-1', delta })),
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: 'stop', usage: testUsage },
  ]);
}

function toolCallStream(toolCallId: string, toolName: string, inputJson: string) {
  return convertArrayToReadableStream([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: `id-${toolCallId}`, modelId: 'mock-model-id', timestamp: new Date(0) },
    { type: 'tool-call', toolCallId, toolName, input: inputJson, providerExecuted: false },
    { type: 'finish', finishReason: 'tool-calls', usage: testUsage },
  ]);
}

/**
 * Real harness whose agent calls `writeDoc` (an `edit`-category tool that
 * records execution) then replies — the same shape as the §4.2e gate tests.
 * `onBeforeQueuedTurn` forwards to `HarnessConfig.sessions`.
 */
function buildHarness(opts: {
  permissions?: HarnessMode['permissions'];
  defaultPermissionPolicy?: PermissionPolicy;
  onBeforeQueuedTurn?: NonNullable<HarnessConfig['sessions']>['onBeforeQueuedTurn'];
  sessionStorage?: InMemoryHarness;
}) {
  const ran = { writeDoc: false };
  const prompts: string[] = [];
  const writeDoc = createTool({
    id: 'writeDoc',
    description: 'edit a doc',
    inputSchema: z.object({ text: z.string() }),
    execute: async input => {
      ran.writeDoc = true;
      return { wrote: (input as { text: string }).text };
    },
  });

  let call = 0;
  const model = new MockLanguageModelV2({
    doStream: async options => {
      prompts.push(JSON.stringify(options.prompt));
      call++;
      if (call === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: toolCallStream('call-1', 'writeDoc', JSON.stringify({ text: 'hello' })),
        };
      }
      return { rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [], stream: textStream(['done']) };
    },
  });

  const agent = new Agent({ id: 'default', name: 'default', instructions: 'use writeDoc', model, tools: { writeDoc } });
  const mode: HarnessMode = {
    id: 'default',
    agentId: 'default',
    ...(opts.permissions ? { permissions: opts.permissions } : {}),
  };
  const storage = new InMemoryStore();
  const harness = new Harness({
    agents: { default: agent } as any,
    storage,
    modes: [mode],
    defaultModeId: 'default',
    toolCategoryResolver: (name: string) => (name === 'writeDoc' ? 'edit' : null),
    ...(opts.defaultPermissionPolicy ? { defaultPermissionPolicy: opts.defaultPermissionPolicy } : {}),
    ...(opts.onBeforeQueuedTurn !== undefined || opts.sessionStorage !== undefined
      ? {
          sessions: {
            ...(opts.onBeforeQueuedTurn !== undefined ? { onBeforeQueuedTurn: opts.onBeforeQueuedTurn } : {}),
            ...(opts.sessionStorage !== undefined ? { storage: opts.sessionStorage } : {}),
          },
        }
      : {}),
  });
  return { harness, ran, prompts, storage };
}

describe('sessions.onBeforeQueuedTurn — pre-drain hook', () => {
  it('runs before the turn snapshot: a grant made in the hook allows an ask-gated tool', async () => {
    const { harness, ran } = buildHarness({
      permissions: { categories: { edit: 'ask' }, tools: {} },
      onBeforeQueuedTurn: async ({ session }) => {
        await session.permissions.grantTool({ toolName: 'writeDoc' });
      },
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      const result = (await session.queue({ content: 'write it' })) as any;
      // The hook's grant landed before the snapshot → ask resolves to allow.
      expect(ran.writeDoc).toBe(true);
      expect(result.finishReason).not.toBe('suspended');
      expect(result.text).toContain('done');
    } finally {
      await harness.shutdown();
    }
  });

  it('runs before the turn snapshot: a revoke inside the hook re-suspends an ask-gated tool', async () => {
    const { harness, ran } = buildHarness({
      permissions: { categories: { edit: 'ask' }, tools: {} },
      onBeforeQueuedTurn: async ({ session }) => {
        await session.permissions.revokeTool({ toolName: 'writeDoc' });
      },
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      // Grant exists at queue admission; the hook strips it before dispatch.
      await session.permissions.grantTool({ toolName: 'writeDoc' });
      const events: HarnessEvent[] = [];
      session.subscribe(e => events.push(e));
      const queued = session.queue({ content: 'write it' });

      // The revoked grant never reaches the snapshot → the tool asks instead
      // of running. The drain parks on the suspension; approve to settle.
      for (let i = 0; i < 50 && session.getRecord().pendingResume === undefined; i++) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(session.getRecord().pendingResume?.kind).toBe('tool-approval');
      expect(ran.writeDoc).toBe(false);

      await session.respondToToolApproval({ approved: true });
      await queued;
      expect(ran.writeDoc).toBe(true);
    } finally {
      await harness.shutdown();
    }
  });

  it('receives the session and the queued item', async () => {
    const seen: Array<{ sessionId: string; itemId: string; content: string }> = [];
    const { harness, prompts } = buildHarness({
      onBeforeQueuedTurn: async ({ session, item }) => {
        seen.push({ sessionId: session.id, itemId: item.id, content: item.content });
        // The hook receives a deep copy — mutating it must not corrupt the
        // live `pendingQueue` entry that the drain dispatches next.
        item.content = 'hook-mutated';
      },
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      await session.queue({ content: 'queued work', admissionId: 'adm-hook-1' });
      expect(seen).toHaveLength(1);
      expect(seen[0]!.sessionId).toBe(session.id);
      expect(seen[0]!.content).toBe('queued work');
      expect(seen[0]!.itemId.length).toBeGreaterThan(0);
      expect(prompts.some(prompt => prompt.includes('queued work'))).toBe(true);
      expect(prompts.some(prompt => prompt.includes('hook-mutated'))).toBe(false);
    } finally {
      await harness.shutdown();
    }
  });

  it('is not invoked for message() turns', async () => {
    let calls = 0;
    const { harness, ran } = buildHarness({
      onBeforeQueuedTurn: async () => {
        calls++;
      },
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      await session.message({ content: 'write it' });
      expect(ran.writeDoc).toBe(true);
      expect(calls).toBe(0);
    } finally {
      await harness.shutdown();
    }
  });

  it('is not invoked for a completed receipt replayed by the drain', async () => {
    let calls = 0;
    const { harness } = buildHarness({
      onBeforeQueuedTurn: async () => {
        calls++;
      },
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      const now = Date.now();
      const queuedItemId = 'q-completed';
      const storedResult = {
        finishReason: 'stop',
        text: 'already done',
        usage: testUsage,
      };
      await (session as any)._flushUpdate((prev: any) => ({
        ...prev,
        pendingQueue: [
          {
            id: queuedItemId,
            admissionId: 'adm-completed',
            admissionHash: 'hash-completed',
            enqueuedAt: now,
            content: 'no dispatch needed',
            attachments: [],
          },
        ],
        queueAdmissionReceipts: {
          ...(prev.queueAdmissionReceipts ?? {}),
          [queuedItemId]: {
            admissionId: 'adm-completed',
            admissionHash: 'hash-completed',
            queuedItemId,
            status: 'completed',
            result: storedResult,
            attempts: 1,
            enqueuedAt: now,
            acceptedAt: now,
            completedAt: now,
            postRunFinalizedAt: now,
            updatedAt: now,
          },
        },
      }));

      await (session as any)._kickQueueDrain();
      expect(calls).toBe(0);
      expect(session.getRecord().pendingQueue).toEqual([]);
    } finally {
      await harness.shutdown();
    }
  });

  it('never runs for an already-dispatched receipt recovered from durable evidence', async () => {
    let calls = 0;
    const storage = new InMemoryHarness({ db: new InMemoryDB() });
    const { harness } = buildHarness({
      sessionStorage: storage,
      onBeforeQueuedTurn: async () => {
        calls++;
        // Even a fatal hook error must not discard a queued turn that already
        // dispatched and left durable completion evidence — recovery wins.
        throw new Error('reconcile bug');
      },
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      const now = Date.now();
      const queuedItemId = 'q-recovered';
      await (session as any)._flushUpdate((prev: any) => ({
        ...prev,
        pendingQueue: [
          {
            id: queuedItemId,
            admissionId: 'adm-recovered',
            admissionHash: 'hash-recovered',
            enqueuedAt: now,
            content: 'already dispatched',
            attachments: [],
          },
        ],
        queueAdmissionReceipts: {
          ...(prev.queueAdmissionReceipts ?? {}),
          [queuedItemId]: {
            admissionId: 'adm-recovered',
            admissionHash: 'hash-recovered',
            queuedItemId,
            status: 'accepted',
            runId: 'run-recovered',
            signalId: 'signal-recovered',
            attempts: 1,
            enqueuedAt: now,
            acceptedAt: now,
            updatedAt: now,
          },
        },
      }));
      await storage.writeMessageResultEvidence({
        harnessName: 'default',
        sessionId: session.id,
        resourceId: 'u1',
        threadId: session.threadId,
        signalId: 'signal-recovered',
        runId: 'run-recovered',
        admissionId: 'adm-recovered',
        admissionHash: 'hash-recovered',
        status: 'completed',
        result: { finishReason: 'stop', text: 'recovered result', usage: testUsage },
        createdAt: now,
        updatedAt: now,
      });

      await (session as any)._kickQueueDrain();
      // Let the recovery settle: drain completes the item without dispatch.
      for (let i = 0; i < 50 && session.getRecord().pendingQueue.length > 0; i++) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      expect(calls).toBe(0);
      expect(session.getRecord().pendingQueue).toEqual([]);
      expect(session.getRecord().queueAdmissionReceipts?.[queuedItemId]).toMatchObject({
        status: 'completed',
      });
    } finally {
      await harness.shutdown();
    }
  });

  it('deferred hook: item parks, retries at retryAt, and does not burn the receipt attempt budget', async () => {
    let calls = 0;
    const { harness, ran } = buildHarness({
      onBeforeQueuedTurn: async () => {
        calls++;
        if (calls === 1) {
          throw new HarnessQueuedTurnDeferredError({ retryAt: Date.now(), cause: new Error('store down') });
        }
      },
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      const result = (await session.queue({ content: 'write it', admissionId: 'adm-deferred' })) as any;
      // First attempt deferred, retry succeeded → exactly two hook invocations
      // and one admission attempt recorded.
      expect(calls).toBe(2);
      expect(ran.writeDoc).toBe(true);
      expect(result.text).toContain('done');
      const receipt = Object.values(session.getRecord().queueAdmissionReceipts ?? {}).find(
        r => r.admissionId === 'adm-deferred',
      );
      expect(receipt?.attempts).toBe(1);
    } finally {
      await harness.shutdown();
    }
  });

  it('non-deferred hook error fails the queued item permanently', async () => {
    const { harness, ran } = buildHarness({
      onBeforeQueuedTurn: async () => {
        throw new Error('reconcile bug');
      },
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      const events: HarnessEvent[] = [];
      session.subscribe(e => events.push(e));

      await expect(session.queue({ content: 'write it', admissionId: 'adm-fatal' })).rejects.toThrow('reconcile bug');
      expect(ran.writeDoc).toBe(false);
      expect(session.getRecord().pendingQueue).toEqual([]);
      expect(events.some(e => e.type === 'queue_failed')).toBe(true);
      const receipt = Object.values(session.getRecord().queueAdmissionReceipts ?? {}).find(
        r => r.admissionId === 'adm-fatal',
      );
      expect(receipt?.status).toBe('failed');
    } finally {
      await harness.shutdown();
    }
  });

  it('fires on every drain attempt for each queued item', async () => {
    const seen: string[] = [];
    const { harness } = buildHarness({
      onBeforeQueuedTurn: async ({ item }) => {
        seen.push(item.content);
      },
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      await session.queue({ content: 'first' });
      await session.queue({ content: 'second' });
      expect(seen).toEqual(['first', 'second']);
    } finally {
      await harness.shutdown();
    }
  });

  it('absent hook: queued drain is unchanged', async () => {
    const { harness, ran } = buildHarness({});
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      const result = (await session.queue({ content: 'write it' })) as any;
      expect(ran.writeDoc).toBe(true);
      expect(result.text).toContain('done');
    } finally {
      await harness.shutdown();
    }
  });
});

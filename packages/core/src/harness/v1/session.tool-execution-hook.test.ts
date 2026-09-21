/**
 * Harness v1 — `sessions.onBeforeToolExecution` per-tool revalidation hook.
 *
 * The hook is awaited at the loop's action-time permission gate on every tool
 * call — after the synchronous snapshot policy resolves and before approval
 * resolution/`execute()`. It exists so integrations can revalidate
 * authorization against durable state captured after the turn's immutable
 * permission snapshot (e.g. an owner-scoped grant revoked or expired
 * mid-turn). Returning 'deny' routes through the same auditable
 * `tool_denied` path as a policy deny; throwing fails closed as 'deny'.
 *
 * Covers:
 *   - invocation: receives `{ session, toolName, toolCallId, args, isResume,
 *     policyDecision }` and fires once per tool call, on `message()` turns too
 *   - decisions: 'deny' blocks execution + emits tool_denied(stage:'action'),
 *     void/'allow' defer to the normal gates
 *   - mid-turn revalidation: a grant that authorized the snapshot but is
 *     revoked before a later call is denied even though the snapshot still
 *     resolves 'allow'
 *   - resume: the hook fires again on the approval-resume leg and can deny an
 *     approved call whose backing grant vanished during the HITL wait
 *   - fail-closed: a thrown error denies the call rather than executing it
 *   - hook-only config (no policy gate): a denial still emits tool_denied
 *   - evented engine: function-valued context entries don't survive transport,
 *     so the step consults the factory-captured live context instead
 *   - absent hook: behavior unchanged
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '../../agent/__tests__/mock-model';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';

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

type OnBeforeToolExecution = NonNullable<HarnessConfig['sessions']>['onBeforeToolExecution'];
type HookInput = Parameters<NonNullable<OnBeforeToolExecution>>[0];

/**
 * Real harness whose agent calls `writeDoc` (an `edit`-category tool that
 * records execution) then replies. `onBeforeToolExecution` forwards to
 * `HarnessConfig.sessions`. `toolCallsPerTurn` controls how many sequential
 * `writeDoc` calls the model emits before its final text reply.
 */
function buildHarness(opts: {
  permissions?: HarnessMode['permissions'];
  defaultPermissionPolicy?: PermissionPolicy;
  onBeforeToolExecution?: OnBeforeToolExecution;
  toolCallsPerTurn?: number;
  onExecute?: () => void;
}) {
  const ran = { executions: 0 };
  const writeDoc = createTool({
    id: 'writeDoc',
    description: 'edit a doc',
    inputSchema: z.object({ text: z.string() }),
    execute: async input => {
      ran.executions++;
      opts.onExecute?.();
      return { wrote: (input as { text: string }).text };
    },
  });

  let call = 0;
  const toolCallsPerTurn = opts.toolCallsPerTurn ?? 1;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      call++;
      if (call <= toolCallsPerTurn) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: toolCallStream(`call-${String(call)}`, 'writeDoc', JSON.stringify({ text: `hello ${call}` })),
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
  const harness = new Harness({
    agents: { default: agent } as any,
    storage: new InMemoryStore(),
    modes: [mode],
    defaultModeId: 'default',
    toolCategoryResolver: (name: string) => (name === 'writeDoc' ? 'edit' : null),
    ...(opts.defaultPermissionPolicy ? { defaultPermissionPolicy: opts.defaultPermissionPolicy } : {}),
    ...(opts.onBeforeToolExecution !== undefined
      ? { sessions: { onBeforeToolExecution: opts.onBeforeToolExecution } }
      : {}),
  });
  return { harness, ran };
}

describe('sessions.onBeforeToolExecution — per-tool revalidation hook', () => {
  it('receives { session, toolName, toolCallId, args, isResume, policyDecision } for each tool call', async () => {
    const seen: HookInput[] = [];
    const { harness, ran } = buildHarness({
      permissions: { categories: { edit: 'allow' }, tools: {} },
      onBeforeToolExecution: async input => {
        seen.push({ ...input });
      },
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      const result = (await session.message({ content: 'write it' })) as any;
      expect(ran.executions).toBe(1);
      expect(result.text).toContain('done');
      expect(seen).toHaveLength(1);
      expect(seen[0]?.session.id).toBe(session.id);
      expect(seen[0]?.toolName).toBe('writeDoc');
      expect(seen[0]?.toolCallId).toBe('call-1');
      expect(seen[0]?.args).toEqual({ text: 'hello 1' });
      expect(seen[0]?.isResume).toBe(false);
      expect(seen[0]?.policyDecision).toBe('allow');
    } finally {
      await harness.shutdown();
    }
  });

  it("'deny' blocks execution and surfaces tool_denied(stage:'action')", async () => {
    const { harness, ran } = buildHarness({
      permissions: { categories: { edit: 'allow' }, tools: {} },
      onBeforeToolExecution: async () => 'deny',
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      const events: HarnessEvent[] = [];
      session.subscribe(e => events.push(e));
      const result = (await session.message({ content: 'write it' })) as any;
      expect(ran.executions).toBe(0);
      expect(result.text).toContain('done');
      const denied = events.filter(e => e.type === 'tool_denied') as Array<{
        toolName: string;
        stage: string;
        toolCallId?: string;
      }>;
      expect(denied.some(e => e.stage === 'action' && e.toolName === 'writeDoc' && e.toolCallId === 'call-1')).toBe(
        true,
      );
    } finally {
      await harness.shutdown();
    }
  });

  it('mid-turn revocation: a grant-validated call denies the next call once durable state changes', async () => {
    // A stand-in durable grant store: the first execution models the owner
    // revoking the grant while the turn is still in flight. The turn's
    // snapshot resolved 'allow' for BOTH calls, so only the revalidation
    // hook can catch the second.
    const durableGrants = new Set(['writeDoc']);
    const hookInputs: HookInput[] = [];
    const { harness, ran } = buildHarness({
      permissions: { categories: { edit: 'allow' }, tools: {} },
      toolCallsPerTurn: 2,
      onExecute: () => durableGrants.delete('writeDoc'),
      onBeforeToolExecution: async input => {
        hookInputs.push({ ...input });
        if (input.toolName === 'writeDoc' && input.policyDecision === 'allow' && !durableGrants.has('writeDoc')) {
          return 'deny';
        }
      },
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      const events: HarnessEvent[] = [];
      session.subscribe(e => events.push(e));
      const result = (await session.message({ content: 'write it' })) as any;
      // First call revalidated against the live grant and ran; the second was
      // denied even though the frozen snapshot still resolved 'allow'.
      expect(ran.executions).toBe(1);
      expect(result.text).toContain('done');
      expect(hookInputs.map(i => i.toolCallId)).toEqual(['call-1', 'call-2']);
      expect(
        (events.filter(e => e.type === 'tool_denied') as Array<{ stage: string; toolCallId?: string }>).some(
          e => e.stage === 'action' && e.toolCallId === 'call-2',
        ),
      ).toBe(true);
    } finally {
      await harness.shutdown();
    }
  });

  it('a thrown error fails closed as deny', async () => {
    const { harness, ran } = buildHarness({
      permissions: { categories: { edit: 'allow' }, tools: {} },
      onBeforeToolExecution: async () => {
        throw new Error('grant store unreachable');
      },
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      const events: HarnessEvent[] = [];
      session.subscribe(e => events.push(e));
      await session.message({ content: 'write it' });
      expect(ran.executions).toBe(0);
      expect(
        (events.filter(e => e.type === 'tool_denied') as Array<{ stage: string }>).some(e => e.stage === 'action'),
      ).toBe(true);
    } finally {
      await harness.shutdown();
    }
  });

  it('an unrecognized return value fails closed as deny', async () => {
    const { harness, ran } = buildHarness({
      permissions: { categories: { edit: 'allow' }, tools: {} },
      onBeforeToolExecution: async () => 'bogus' as 'allow',
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      await session.message({ content: 'write it' });
      expect(ran.executions).toBe(0);
    } finally {
      await harness.shutdown();
    }
  });

  it('revalidates on the approval-resume leg: a grant revoked during the HITL wait denies the approved call', async () => {
    // Models the exact PF-4306 residual: the tool asked, the user approved,
    // but the durable grant disappeared while the approval was pending.
    const durableGrants = new Set(['writeDoc']);
    const hookInputs: HookInput[] = [];
    const { harness, ran } = buildHarness({
      permissions: { categories: { edit: 'ask' }, tools: {} },
      onBeforeToolExecution: async input => {
        hookInputs.push({ ...input });
        if (input.toolName === 'writeDoc' && !durableGrants.has('writeDoc')) {
          return 'deny';
        }
      },
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      const events: HarnessEvent[] = [];
      session.subscribe(e => events.push(e));
      const suspended = (await session.message({ content: 'write it' })) as any;
      expect(suspended.finishReason).toBe('suspended');
      expect(ran.executions).toBe(0);
      // The pre-approval leg fired the hook too (isResume:false, policy 'ask')
      // while the grant was still live.
      expect(hookInputs).toHaveLength(1);
      expect(hookInputs[0]?.isResume).toBe(false);
      expect(hookInputs[0]?.policyDecision).toBe('ask');

      durableGrants.delete('writeDoc');
      await session.respondToToolApproval({ approved: true });

      expect(ran.executions).toBe(0);
      expect(hookInputs).toHaveLength(2);
      expect(hookInputs[1]?.isResume).toBe(true);
      expect(
        (events.filter(e => e.type === 'tool_denied') as Array<{ stage: string; toolCallId?: string }>).some(
          e => e.stage === 'action' && e.toolCallId === 'call-1',
        ),
      ).toBe(true);
    } finally {
      await harness.shutdown();
    }
  });

  it('passes the approved call through when durable state still holds on resume', async () => {
    const durableGrants = new Set(['writeDoc']);
    const { harness, ran } = buildHarness({
      permissions: { categories: { edit: 'ask' }, tools: {} },
      onBeforeToolExecution: async input => {
        if (input.toolName === 'writeDoc' && !durableGrants.has('writeDoc')) {
          return 'deny';
        }
      },
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      const suspended = (await session.message({ content: 'write it' })) as any;
      expect(suspended.finishReason).toBe('suspended');
      await session.respondToToolApproval({ approved: true });
      expect(ran.executions).toBe(1);
    } finally {
      await harness.shutdown();
    }
  });

  it("hook-only config: a denial with no policy gate still emits tool_denied(stage:'action')", async () => {
    // No `permissions` — the §4.2e policy gate is unengaged, so this proves the
    // deny-observability callback is installed on hook-only sessions too.
    const { harness, ran } = buildHarness({
      onBeforeToolExecution: async () => 'deny',
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      const events: HarnessEvent[] = [];
      session.subscribe(e => events.push(e));
      await session.message({ content: 'write it' });
      expect(ran.executions).toBe(0);
      expect(
        (events.filter(e => e.type === 'tool_denied') as Array<{ stage: string; toolName: string }>).some(
          e => e.stage === 'action' && e.toolName === 'writeDoc',
        ),
      ).toBe(true);
    } finally {
      await harness.shutdown();
    }
  });

  it('evented execution: the hook still gates the call even though the context function did not transport', async () => {
    // MASTRA_EVENTED_EXECUTION transports requestContext as JSON — function
    // entries (policy resolver, this hook, the deny callback) are stripped.
    // The tool-call step falls back to the factory-captured live context, so
    // the hook MUST still fire and its denial must still be audited.
    const previous = process.env.MASTRA_EVENTED_EXECUTION;
    process.env.MASTRA_EVENTED_EXECUTION = 'true';
    let hookCalls = 0;
    const { harness, ran } = buildHarness({
      permissions: { categories: { edit: 'allow' }, tools: {} },
      onBeforeToolExecution: async () => {
        hookCalls++;
        return 'deny';
      },
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      const events: HarnessEvent[] = [];
      session.subscribe(e => events.push(e));
      await session.message({ content: 'write it' });
      expect(hookCalls).toBe(1);
      expect(ran.executions).toBe(0);
      expect(
        (events.filter(e => e.type === 'tool_denied') as Array<{ stage: string }>).some(e => e.stage === 'action'),
      ).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.MASTRA_EVENTED_EXECUTION;
      else process.env.MASTRA_EVENTED_EXECUTION = previous;
      await harness.shutdown();
    }
  });

  it('a request aborted while the awaited hook runs does not dispatch the tool', async () => {
    // The hook can span real I/O; an abort landing inside that window must
    // still stop the call even when the hook resolves 'allow'.
    const { harness, ran } = buildHarness({
      permissions: { categories: { edit: 'allow' }, tools: {} },
      onBeforeToolExecution: async input => {
        input.session.abort();
        return 'allow';
      },
    });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      // The turn unwinds as aborted; whether message() resolves an aborted
      // result or rejects with HarnessAbortedError, the tool must not run.
      await (session.message({ content: 'write it' }) as Promise<unknown>).catch(() => undefined);
      expect(ran.executions).toBe(0);
    } finally {
      await harness.shutdown();
    }
  });

  it('absent hook: behavior is unchanged (allowed tool runs, no tool_denied)', async () => {
    const { harness, ran } = buildHarness({ permissions: { categories: { edit: 'allow' }, tools: {} } });
    try {
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
      const events: HarnessEvent[] = [];
      session.subscribe(e => events.push(e));
      const result = (await session.message({ content: 'write it' })) as any;
      expect(ran.executions).toBe(1);
      expect(result.text).toContain('done');
      expect(events.some(e => e.type === 'tool_denied')).toBe(false);
    } finally {
      await harness.shutdown();
    }
  });
});

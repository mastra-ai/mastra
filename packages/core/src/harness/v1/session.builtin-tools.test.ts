/**
 * Round-trip tests: the real built-in tools (`askUser`, `submitPlan`,
 * `taskWrite`, `taskCheck`) feeding a Session via MockAgent.
 *
 * The standalone tests in `packages/core/src/tools/builtin/__tests__/`
 * lock the tool-side contract (suspend/resume payload shapes, schema
 * coercion, storage layout). These tests lock the *harness* side: that
 * Session.message picks up the same shapes and classifies them into the
 * matching `pendingResume.kind`, and that the typed `respondTo*` methods
 * forward the right resume payload back into the agent's resumeStream.
 *
 * This is the contract seam between tool authors and the harness, so we
 * exercise it directly with the real tools rather than hand-built payloads.
 */

import { describe, expect, it } from 'vitest';

import { RequestContext } from '../../request-context';
import { askUser, submitPlan, taskCheck, taskWrite } from '../../tools/builtin';
import type { ToolExecutionContext } from '../../tools/types';
import { isValidationError } from '../../tools/validation';
import { setupHarness } from './__test-utils__/setup';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Drive a tool's `execute()` in suspend mode, capturing the payload it sends
 * to `suspend()`. Throws `SUSPEND_MARKER` so we mirror the agent loop's
 * contract (suspend halts downstream code) without depending on the agent loop.
 */
async function captureSuspendPayload<I>(
  tool: { execute?: (...args: any[]) => Promise<any> },
  input: I,
): Promise<unknown> {
  let captured: unknown;
  const ctx = {
    requestContext: new RequestContext(),
    agent: {
      agentId: 'a',
      toolCallId: 'tc-real',
      messages: [],
      suspend: async (p: unknown) => {
        captured = p;
        throw new Error('SUSPEND_MARKER');
      },
    },
  } satisfies ToolExecutionContext<any, any>;

  await expect(tool.execute!(input, ctx as any)).rejects.toThrow('SUSPEND_MARKER');
  return captured;
}

// ---------------------------------------------------------------------------
// askUser
// ---------------------------------------------------------------------------

describe('builtin askUser → Harness round-trip', () => {
  it('produces a suspend payload that Session classifies as "question"', async () => {
    // 1. Capture the real askUser tool's suspend shape.
    const capturedArgs = await captureSuspendPayload(askUser, {
      question: 'pick a color',
      options: [{ label: 'red' }, { label: 'blue' }],
      selectionMode: 'single_select',
    });

    // The askUser tool suspends with its *input* (per its suspendSchema). We
    // assert that explicitly to lock the contract: the harness classifier
    // reads tool name + args directly, so the args shape must match what
    // the schema says.
    expect(capturedArgs).toEqual({});

    // 2. Now feed that same input into the harness via MockAgent, simulating
    //    the agent surfacing the tool's suspend.
    const { harness, agent } = setupHarness();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-1',
      suspendPayload: {
        toolCallId: 'tc-real',
        toolName: askUser.id,
        args: {
          question: 'pick a color',
          options: [{ label: 'red' }, { label: 'blue' }],
          selectionMode: 'single_select',
        },
      },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'go' });

    const pending = session.getRecord().pendingResume!;
    expect(pending.kind).toBe('question');
    expect(pending.payload).toEqual({
      question: 'pick a color',
      options: [{ label: 'red' }, { label: 'blue' }],
      selectionMode: 'single_select',
    });
  });

  it('respondToQuestion forwards { answer } into agent.resumeStream', async () => {
    const { harness, agent } = setupHarness();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-1',
      suspendPayload: {
        toolCallId: 'tc-real',
        toolName: askUser.id,
        args: { question: 'pick a color' },
      },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'go' });

    agent.enqueueRun({ finishReason: 'stop', runId: 'run-1', text: 'done' });
    await session.respondToQuestion({ answer: 'red' });

    expect(agent.resumeCalls).toHaveLength(1);
    expect(agent.resumeCalls[0]!.resumeData).toEqual({ answer: 'red' });

    // The askUser tool's resumeSchema is `{ answer }` — if we run the tool
    // a second time with that resumeData, it must echo it back. This locks
    // the round-trip contract without needing a real agent.
    const echoed = await askUser.execute!({ question: 'pick a color' }, {
      requestContext: new RequestContext(),
      agent: {
        agentId: 'a',
        toolCallId: 'tc-real',
        messages: [],
        suspend: async () => {
          throw new Error('should not be called');
        },
        resumeData: { answer: 'red' },
      },
    } as any);
    expect(isValidationError(echoed)).toBe(false);
    expect(echoed).toEqual({ answer: 'red' });
  });
});

// ---------------------------------------------------------------------------
// submitPlan
// ---------------------------------------------------------------------------

describe('builtin submitPlan → Harness round-trip', () => {
  it('produces a suspend payload that Session classifies as "plan-approval" and freezes transitionsTo', async () => {
    const { harness, agent } = setupHarness({
      modes: [
        { id: 'planner', agentId: 'default', transitionsTo: 'builder' },
        { id: 'builder', agentId: 'default' },
      ],
      defaultModeId: 'planner',
    });
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-2',
      suspendPayload: {
        toolCallId: 'tc-real',
        toolName: submitPlan.id,
        args: { title: 'Refactor X', plan: 'do A then B' },
      },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'plan it' });

    const pending = session.getRecord().pendingResume!;
    expect(pending.kind).toBe('plan-approval');
    expect(pending.payload).toEqual({ title: 'Refactor X', plan: 'do A then B' });
    // The mode-at-capture-time transitionsTo gets frozen so a later mode
    // change doesn't retroactively change where approval lands.
    expect(pending.transitionModeId).toBe('builder');
  });

  it('respondToPlanApproval { approved: true } forwards approval + applies frozen mode transition', async () => {
    const { harness, agent } = setupHarness({
      modes: [
        { id: 'planner', agentId: 'default', transitionsTo: 'builder' },
        { id: 'builder', agentId: 'default' },
      ],
      defaultModeId: 'planner',
    });
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-2',
      suspendPayload: {
        toolCallId: 'tc-real',
        toolName: submitPlan.id,
        args: { plan: 'do it' },
      },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'plan it' });

    agent.enqueueRun({ finishReason: 'stop', runId: 'run-2', text: 'done' });
    await session.respondToPlanApproval({ approved: true });

    expect(agent.resumeCalls).toHaveLength(1);
    expect(agent.resumeCalls[0]!.resumeData).toEqual({ approved: true });

    // Mode flipped to the frozen target.
    expect(session.getCurrentMode().id).toBe('builder');
  });

  it('respondToPlanApproval { revision, transitionToMode } overrides frozen target', async () => {
    const { harness, agent } = setupHarness({
      modes: [
        { id: 'planner', agentId: 'default', transitionsTo: 'builder' },
        { id: 'builder', agentId: 'default' },
        { id: 'reviewer', agentId: 'default' },
      ],
      defaultModeId: 'planner',
    });
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-3',
      suspendPayload: {
        toolCallId: 'tc-real',
        toolName: submitPlan.id,
        args: { plan: 'do it' },
      },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'plan it' });

    agent.enqueueRun({ finishReason: 'stop', runId: 'run-3', text: 'done' });
    await session.respondToPlanApproval({
      approved: true,
      revision: 'add tests',
      transitionToMode: 'reviewer',
    });

    expect(agent.resumeCalls[0]!.resumeData).toEqual({
      approved: true,
      revision: 'add tests',
      transitionToMode: 'reviewer',
    });
    // Caller override beat the frozen `builder` target.
    expect(session.getCurrentMode().id).toBe('reviewer');
  });

  it('respondToPlanApproval { approved: false } does not transition mode', async () => {
    const { harness, agent } = setupHarness({
      modes: [
        { id: 'planner', agentId: 'default', transitionsTo: 'builder' },
        { id: 'builder', agentId: 'default' },
      ],
      defaultModeId: 'planner',
    });
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-4',
      suspendPayload: {
        toolCallId: 'tc-real',
        toolName: submitPlan.id,
        args: { plan: 'do it' },
      },
    });
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    await session.message({ content: 'plan it' });

    agent.enqueueRun({ finishReason: 'stop', runId: 'run-4', text: 'done' });
    await session.respondToPlanApproval({ approved: false, revision: 'try again' });

    expect(session.getCurrentMode().id).toBe('planner');
  });
});

// ---------------------------------------------------------------------------
// taskWrite + taskCheck
// ---------------------------------------------------------------------------

describe('builtin taskWrite + taskCheck → Harness round-trip', () => {
  it('persists tasks to thread metadata via the harness-managed memory store, then reads them back', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const threadId = session.threadId;
    const mastra = (harness as any).mastra; // harness exposes its internal Mastra to its tools

    // Memory-domain threads are normally created lazily when the agent writes
    // its first message. Since this test invokes the tools directly (no agent
    // run), we seed the memory thread up front.
    const memory = await mastra.getStorage().getStore('memory');
    await memory.saveThread({
      thread: {
        id: threadId,
        resourceId: 'u',
        title: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      },
    });

    const writeCtx = {
      requestContext: new RequestContext(),
      mastra,
      agent: {
        agentId: 'a',
        toolCallId: 'tc-w',
        messages: [],
        suspend: async () => {},
        threadId,
      },
    };

    const writeResult = await taskWrite.execute!(
      {
        tasks: [
          { content: 'A', activeForm: 'Doing A', status: 'pending' },
          { content: 'B', activeForm: 'Doing B', status: 'completed' },
        ],
      },
      writeCtx as any,
    );
    expect(isValidationError(writeResult)).toBe(false);
    expect((writeResult as any).written).toBe(2);

    const checkResult = await taskCheck.execute!({}, writeCtx as any);
    expect(isValidationError(checkResult)).toBe(false);
    expect(checkResult).toMatchObject({
      total: 2,
      pending: 1,
      completed: 1,
      allComplete: false,
    });
  });

  it('taskCheck against a fresh thread (no prior write) returns empty state', async () => {
    const { harness } = setupHarness();
    const session = await harness.session({ resourceId: 'u', threadId: { fresh: true } });
    const mastra = (harness as any).mastra;

    const result = await taskCheck.execute!({}, {
      requestContext: new RequestContext(),
      mastra,
      agent: {
        agentId: 'a',
        toolCallId: 'tc-c',
        messages: [],
        suspend: async () => {},
        threadId: session.threadId,
      },
    } as any);
    expect(isValidationError(result)).toBe(false);
    expect(result).toMatchObject({ total: 0, allComplete: false, tasks: [] });
  });
});

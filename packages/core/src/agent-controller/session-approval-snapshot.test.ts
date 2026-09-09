import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../request-context';
import { SessionRunEngine } from './session-run-engine';
import { createTestSession } from './test-utils';
import type { AgentControllerDisplayState } from './types';

async function createApprovalRun() {
  const { session } = await createTestSession();
  const engine = new SessionRunEngine(session, session.machinery);
  const toolStarted = Promise.withResolvers<void>();
  const toolFinished = Promise.withResolvers<void>();
  const runTool = async () => {
    toolStarted.resolve();
    await toolFinished.promise;
  };
  vi.spyOn(session, 'approveToolCall').mockImplementation(runTool);
  vi.spyOn(session, 'declineToolCall').mockImplementation(runTool);
  const displayStates: AgentControllerDisplayState[] = [];
  session.subscribe(event => {
    if (event.type === 'display_state_changed') displayStates.push(structuredClone(event.displayState));
  });
  session.emit({ type: 'agent_start' });
  const processing = engine.processStreamChunk(
    engine.createStreamState(),
    {
      type: 'tool-call-approval',
      payload: { toolCallId: 'checkout-1', toolName: 'checkout', args: {} },
    },
    new RequestContext(),
  );
  return { session, toolStarted, toolFinished, processing, displayStates };
}

afterEach(() => vi.restoreAllMocks());

describe('approval display snapshots', () => {
  it.each(['approve', 'decline'] as const)(
    'clears an accepted %s response before long tool execution',
    async decision => {
      const { session, toolStarted, toolFinished, processing, displayStates } = await createApprovalRun();
      try {
        expect(session.displayState.snapshot().displayState.pendingApproval?.toolCallId).toBe('checkout-1');
        session.respondToToolApproval({ decision, toolCallId: 'checkout-1' });
        await toolStarted.promise;

        expect(session.displayState.snapshot().displayState.pendingApproval).toBeNull();
        expect(displayStates.at(-1)?.pendingApproval).toBeNull();
        expect(session.displayState.get().isRunning).toBe(true);
      } finally {
        session.respondToToolApproval({ decision: 'decline', toolCallId: 'checkout-1' });
        toolFinished.resolve();
        await processing;
      }
    },
  );

  it('keeps the pending prompt when a stale response or failed category grant does not resolve the gate', async () => {
    const { session, toolFinished, processing } = await createApprovalRun();
    try {
      session.respondToToolApproval({ decision: 'approve', toolCallId: 'stale-tool' });
      await Promise.resolve();
      expect(session.displayState.snapshot().displayState.pendingApproval?.toolCallId).toBe('checkout-1');

      session.setCategoryResolver(() => {
        throw new Error('Category lookup failed');
      });
      expect(() =>
        session.respondToToolApproval({ decision: 'always_allow_category', toolCallId: 'checkout-1' }),
      ).toThrow('Category lookup failed');
      await Promise.resolve();
      expect(session.approval.isArmed()).toBe(true);
      expect(session.displayState.snapshot().displayState.pendingApproval?.toolCallId).toBe('checkout-1');
      expect(session.approveToolCall).not.toHaveBeenCalled();
    } finally {
      session.respondToToolApproval({ decision: 'decline', toolCallId: 'checkout-1' });
      toolFinished.resolve();
      await processing;
    }
  });
});

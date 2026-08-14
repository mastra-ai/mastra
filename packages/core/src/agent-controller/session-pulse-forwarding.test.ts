import { describe, expect, it } from 'vitest';
import { Mastra } from '../mastra';
import type { PulseRecord, PulseRelationshipRecord } from '../storage/domains/pulse';
import { PulseStorage } from '../storage/domains/pulse';
import { createTestController } from './test-utils';

/** Minimal recording pulse storage (reads are not under test here). */
class RecordingPulseStorage extends PulseStorage {
  pulses: PulseRecord[] = [];

  async batchCreatePulses(records: PulseRecord[]): Promise<void> {
    this.pulses.push(...records);
  }
  async batchCreateRelationships(_records: PulseRelationshipRecord[]): Promise<void> {}
  async listFlows(): Promise<any> {
    return { flows: [], total: 0 };
  }
  async getFlow(): Promise<any> {
    return null;
  }
  async getFlowTimeline(): Promise<any> {
    return [];
  }
  async dangerouslyClearAll(): Promise<void> {
    this.pulses = [];
  }
}

async function createPulseSession() {
  const controller = createTestController();
  const storage = new RecordingPulseStorage();
  const mastra = new Mastra({ agentControllers: { code: controller }, pulse: { storage } });
  await controller.init();
  const session = await controller.createSession({ id: 's1', ownerId: 'o1', resourceId: 'user-1' });
  return { controller, mastra, storage, session };
}

describe('native session → pulse forwarding', () => {
  it('forwards whitelisted session facts onto the PulseBus with session identity', async () => {
    const { mastra, storage, session } = await createPulseSession();

    session.emit({ type: 'tool_approval_required', toolCallId: 'c1', toolName: 'issue_refund', args: {} });
    session.emit({ type: 'agent_end', reason: 'aborted' });
    session.emit({ type: 'follow_up_queued', count: 2, runId: 'run-9' });
    session.emit({ type: 'mode_changed', modeId: 'planner', previousModeId: 'default' });
    session.emit({ type: 'model_changed', modelId: 'openai/gpt-5' });
    session.emit({ type: 'tool_suspension_cancelled', toolCallId: 'c2', toolName: 'deploy', reason: 'timeout' });
    await mastra.pulseBus!.flush();

    const threadId = session.thread.getId();
    expect(threadId).toBeTruthy();

    const byAction = (surface: string, action: string) =>
      storage.pulses.find(p => p.surface === surface && p.action === action);

    const approval = byAction('tool_approval', 'required');
    expect(approval).toMatchObject({
      type: 'decision',
      source: 'session',
      threadId,
      resourceId: 'user-1',
      traceId: '',
    });
    expect(approval!.attributes).toEqual({ toolCallId: 'c1', toolName: 'issue_refund' });

    expect(byAction('agent_controller', 'agent_end')).toMatchObject({ type: 'state' });
    expect(byAction('agent_controller', 'agent_end')!.attributes).toEqual({ reason: 'aborted' });
    // The session-layer abort outcome is authoritative — the extra fact lands too.
    expect(byAction('run_control', 'abort_completed')).toBeDefined();

    expect(byAction('thread_control', 'follow_up_queued')).toMatchObject({ runId: 'run-9' });
    expect(byAction('thread_control', 'follow_up_queued')!.attributes).toEqual({ count: 2 });
    expect(byAction('agent_config', 'mode_changed')!.attributes).toEqual({ modeId: 'planner' });
    expect(byAction('agent_config', 'model_changed')!.attributes).toEqual({ modelId: 'openai/gpt-5' });
    expect(byAction('tool', 'suspension_cancelled')!.attributes).toMatchObject({ toolCallId: 'c2', reason: 'timeout' });

    await mastra.shutdown();
  });

  it("skips events on Eric's SKIP list (state_changed, message_*)", async () => {
    const { mastra, storage, session } = await createPulseSession();

    session.emit({ type: 'state_changed', state: {}, changedKeys: [] });
    session.emit({ type: 'message_start', message: { id: 'm1' } as any });
    session.emit({ type: 'message_end', message: { id: 'm1' } as any });
    await mastra.pulseBus!.flush();

    expect(storage.pulses.filter(p => p.source === 'session')).toHaveLength(0);
    await mastra.shutdown();
  });

  it('does nothing when pulse is not configured', async () => {
    const controller = createTestController();
    const mastra = new Mastra({ agentControllers: { code: controller } });
    await controller.init();
    const session = await controller.createSession({ id: 's1', ownerId: 'o1', resourceId: 'user-1' });

    expect(mastra.pulseBus).toBeUndefined();
    // Emitting whitelisted events must be a no-op (no bus, no forwarder, no rows).
    expect(() =>
      session.emit({ type: 'tool_approval_required', toolCallId: 'c1', toolName: 'x', args: {} }),
    ).not.toThrow();
    await mastra.shutdown();
  });

  it('detaches the forwarder when the session is deleted', async () => {
    const { controller, mastra, storage, session } = await createPulseSession();

    session.emit({ type: 'tool_approval_required', toolCallId: 'c1', toolName: 'x', args: {} });
    await mastra.pulseBus!.flush();
    const before = storage.pulses.length;
    expect(before).toBeGreaterThan(0);

    await controller.deleteSession({ resourceId: 'user-1' });
    session.emit({ type: 'tool_approval_required', toolCallId: 'c2', toolName: 'y', args: {} });
    await mastra.pulseBus!.flush();

    expect(storage.pulses).toHaveLength(before);
    await mastra.shutdown();
  });
});

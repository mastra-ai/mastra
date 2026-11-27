/**
 * A run parked in one process can be resumed in another. When that process shuts down while the resumed tool call
 * still runs, it hands the run back and keeps its lease until the lease expires; recovery can then continue the run
 * in a third process. A follow-up sent to the process that parked the run in that window is answered once. (#30190)
 */
import { expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_TTL_MS = '300';
});

import { EventEmitterPubSub } from '../../events';
import type { Agent } from '../agent';
import { createDurableAgentStream, emitChunkEvent, emitFinishEvent } from '../durable/stream-adapter';
import { startRunStep } from '../run-lease-fence';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';

/** One process's view of the thread events and of a lease table every process shares, like Redis without expiry. */
class LeasePubSub extends EventEmitterPubSub {
  owners = new Map<string, string>();

  async acquireLease(key: string, owner: string): Promise<{ acquired: boolean; owner?: string }> {
    const current = this.owners.get(key);
    if (current && current !== owner) return { acquired: false, owner: current };
    this.owners.set(key, owner);
    return { acquired: true, owner };
  }
  async getLeaseOwner(key: string): Promise<string | undefined> {
    return this.owners.get(key);
  }
  async releaseLease(key: string, owner: string): Promise<void> {
    if (this.owners.get(key) === owner) this.owners.delete(key);
  }
  async renewLease(key: string, owner: string): Promise<boolean> {
    return this.owners.get(key) === owner;
  }
  async transferLease(key: string, fromOwner: string, toOwner: string): Promise<boolean> {
    if (this.owners.get(key) !== fromOwner) return false;
    this.owners.set(key, toOwner);
    return true;
  }
}

// Technical: once the lease of the handed-back run expired, the lease check queued the held follow-up as a new turn but
// left the thread's slot to the record parked here, which still pointed at the dead execution, so nothing started.
// When the recovered execution later finished, its end retired that record but found no held follow-up left to queue
// again, so it drained nothing and the accepted follow-up never ran. (#30190)
it('runs a follow-up sent to the process that parked a run once when the process that resumed it shuts down, its lease expires and recovery finishes the run (#30190)', async () => {
  const pubsub = new LeasePubSub();
  const publishOriginal = pubsub.publish.bind(pubsub);
  const publish = vi.spyOn(pubsub, 'publish');
  const threadId = 'expiry-thread';
  const resourceId = 'expiry-user';
  const target = { resourceId, threadId };
  const options = { memory: { thread: threadId, resource: resourceId } };
  const runId = crypto.randomUUID();
  const makeStream = (streamOptions?: { closeOnSuspend?: boolean; runId?: string }) =>
    createDurableAgentStream({
      pubsub,
      runId: streamOptions?.runId ?? runId,
      messageId: crypto.randomUUID(),
      model: { modelId: 'mock', provider: 'mock', version: 'v3' },
      closeOnSuspend: streamOptions?.closeOnSuspend,
    });
  const events = (type: string) =>
    publish.mock.calls.map(([, event]) => event.data).filter(data => data?.type === type && data.runId === runId);
  const streams: Array<ReturnType<typeof makeStream>> = [];
  const turnInputs: string[] = [];
  const durableMastra = {};
  const agentInProcess = (runtime: AgentThreadStreamRuntime, durable: boolean) => {
    const agent = {
      id: 'expiry-agent',
      getDefaultOptions: async () => ({ autoResumeSuspendedTools: true }),
      ...(durable ? { __hasDurableExecution: () => true, getMastraInstance: () => durableMastra } : {}),
      stream: vi.fn(async (input: unknown, turnOptions: { runId: string }) => {
        turnInputs.push(JSON.stringify(input));
        const turn = makeStream({ runId: turnOptions.runId });
        streams.push(turn);
        await turn.ready;
        await runtime.registerRun(agent, turn.output, turnOptions as any, pubsub);
        return turn.output;
      }),
    } as unknown as Agent<any, any, any, any>;
    return agent;
  };
  const parking = new AgentThreadStreamRuntime();
  const resuming = new AgentThreadStreamRuntime();
  const recovering = new AgentThreadStreamRuntime();
  const agent = agentInProcess(parking, false);
  // The resumed tool call, which ignores the abort.
  const resumedStep = {};
  const settleResumedStep = startRunStep(resumedStep);
  try {
    const first = makeStream({ closeOnSuspend: true });
    streams.push(first);
    await first.ready;
    await parking.registerRun(agent, first.output, options, pubsub);
    await emitChunkEvent(pubsub, runId, {
      type: 'tool-call-suspended',
      payload: { toolCallId: 'call-1', toolName: 'ask', suspendPayload: {} },
      runId,
      from: 'AGENT',
    } as any);
    await vi.waitFor(() => expect(first.output.status).toBe('suspended'));
    first.detach();

    // Another process resumes the run; its resumed tool call is still running.
    const resumed = makeStream();
    streams.push(resumed);
    await resumed.ready;
    await resuming.registerRun(
      agentInProcess(resuming, true),
      resumed.output,
      { ...options, toolCallId: 'call-1' } as any,
      pubsub,
      { continuation: 'across-suspension', stepOwner: () => resumedStep },
    );
    await vi.waitFor(() => expect(events('run-registered')).toHaveLength(2));

    // That process shuts down. The follow-up is forwarded as it hands the run back, and the process exits before its
    // admission of the follow-up reaches anyone.
    let sent: Promise<unknown> | undefined;
    let resumingExits = true;
    publish.mockImplementation(async (topic, event) => {
      const type = event.data?.type;
      if (resumingExits && (type === 'user-message-admitted' || type === 'user-message-presentation')) return;
      if (!sent && event.data?.type === 'run-completed' && event.data.runId === runId) {
        sent = parking.sendSignal(agent, { type: 'user-message', contents: 'my answer' }, target, pubsub).accepted;
      }
      return publishOriginal(topic, event);
    });
    await resuming.shutdown(pubsub, durableMastra, { abortGraceMs: 50 });
    expect(events('run-completed')).toEqual([expect.objectContaining({ status: 'interrupted' })]);
    await expect(sent).resolves.toMatchObject({ action: 'deliver' });

    // The handed-back run keeps its lease while its tool call may still run, so nothing starts.
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(turnInputs).toHaveLength(0);

    // Its lease expires, and long enough later for the lease check to see that twice, recovery continues the run in a
    // third process and finishes it.
    resumingExits = false;
    pubsub.owners.clear();
    await new Promise(resolve => setTimeout(resolve, 500));
    const recovered = makeStream();
    streams.push(recovered);
    await recovered.ready;
    await recovering.registerRun(agentInProcess(recovering, true), recovered.output, options as any, pubsub, {
      continuation: 'across-suspension',
    });
    await vi.waitFor(() => expect(events('run-registered')).toHaveLength(3));
    await emitFinishEvent(pubsub, runId, {
      output: { text: 'done', steps: [] },
      stepResult: { reason: 'stop' },
    } as any);
    await vi.waitFor(() => expect(events('run-completed')).toHaveLength(2));

    await vi.waitFor(() => expect(turnInputs).toHaveLength(1), { timeout: 3_000 });
    expect(turnInputs[0]).toContain('my answer');
    // Long enough for a second turn with the same message to begin.
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(turnInputs).toHaveLength(1);
  } finally {
    settleResumedStep();
    for (const stream of streams) stream.cleanup();
    await pubsub.close();
  }
});

/**
 * Every thread-bound run registered through `registerRun` must hold the
 * cross-process thread lease while it is live. PR #19806 made lease ownership
 * authoritative for run liveness (markActiveIfLive / #waitForRemoteRunToFinish
 * treat a lease-less run as a ghost), so a plain `agent.stream()` run that
 * never acquires the lease is invisible to contending instances — they start
 * competing runs instead of serializing behind it.
 *
 * Kept in its own file (rather than agent-signals.test.ts) so the suite Tyler's
 * PR shipped stays untouched.
 */
import { describe, expect, it, vi } from 'vitest';

import { PubSub } from '../../events/pubsub';
import type { LeaseProvider } from '../../events/pubsub';
import type { EventCallback } from '../../events/types';
import { Mastra } from '../../mastra';
import type { Agent } from '../agent';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';

const AGENT_THREAD_KEY_SEPARATOR = '\u0000';

function nextTick() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function waitForCondition(predicate: () => boolean, timeoutMs = 2_000) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await nextTick();
  }
}

/**
 * Minimal in-memory pubsub that also implements LeaseProvider, mirroring
 * ControlledLeasePubSub in agent-signals.test.ts (copied, not imported, to
 * keep that file untouched).
 */
class ControlledLeasePubSub extends PubSub implements LeaseProvider {
  owners = new Map<string, string>();
  denyAcquire = false;
  failAcquire = false;
  failPublish = false;
  failPublishAfterDelivery = false;
  publishedTypes: string[] = [];
  releaseCalls: Array<{ key: string; owner: string }> = [];
  #subscribers = new Map<string, Set<EventCallback>>();
  #pending = new Set<Promise<void>>();
  #index = 0;

  async publish(topic: string, event: any): Promise<void> {
    if (this.failPublish) throw new Error('publish failed');
    this.publishedTypes.push(event.type);
    const envelope = { ...event, id: `event-${this.#index}`, createdAt: new Date(), index: this.#index++ };
    const subscribers = [...(this.#subscribers.get(topic) ?? [])];
    const pending = new Promise<void>(resolve => {
      setTimeout(() => {
        for (const subscriber of subscribers) subscriber(envelope);
        resolve();
      }, 0);
    });
    this.#pending.add(pending);
    void pending.finally(() => this.#pending.delete(pending));
    await pending;
    if (this.failPublishAfterDelivery) {
      this.failPublishAfterDelivery = false;
      throw new Error('publish acknowledgement failed');
    }
  }

  async subscribe(topic: string, cb: EventCallback): Promise<void> {
    const subscribers = this.#subscribers.get(topic) ?? new Set<EventCallback>();
    subscribers.add(cb);
    this.#subscribers.set(topic, subscribers);
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    this.#subscribers.get(topic)?.delete(cb);
  }

  async flush(): Promise<void> {
    await Promise.all([...this.#pending]);
  }

  async acquireLease(key: string, owner: string): Promise<{ acquired: boolean; owner?: string }> {
    if (this.failAcquire) throw new Error('acquire failed');
    const current = this.owners.get(key);
    if (this.denyAcquire || (current && current !== owner)) return { acquired: false, owner: current };
    this.owners.set(key, owner);
    return { acquired: true, owner };
  }

  async getLeaseOwner(key: string): Promise<string | undefined> {
    return this.owners.get(key);
  }

  async releaseLease(key: string, owner: string): Promise<void> {
    this.releaseCalls.push({ key, owner });
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

describe('registerRun thread lease', () => {
  it('acquires the thread lease for a plain thread-bound run and releases it on completion', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const agent = { id: 'plain-lease-agent' } as Agent<any, any, any, any>;
    const threadId = 'plain-lease-thread';
    const resourceId = 'plain-lease-user';
    const key = [resourceId, threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    const runId = 'plain-lease-run-1';

    let finish!: () => void;
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });
    const fullStream = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'start', runId });
        controller.enqueue({
          type: 'finish',
          runId,
          payload: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, finishReason: 'stop' },
        });
        controller.close();
      },
    });

    const registered = runtime.registerRun(
      agent,
      {
        runId,
        status: 'running',
        fullStream,
        _waitUntilFinished: () => finished,
      } as any,
      { memory: { thread: threadId, resource: resourceId } } as any,
      pubsub,
    );
    expect(registered).toBeDefined();
    await registered;

    // A plain (non-signal) run must own the cross-process thread lease once
    // registration settles — otherwise remote liveness checks treat it as a
    // ghost and contending instances start competing runs.
    expect(pubsub.owners.get(key)).toBe(runId);

    finish();
    // Release is fire-and-forget inside the completion watcher's finally —
    // poll rather than asserting immediately.
    await waitForCondition(() => pubsub.owners.get(key) === undefined);
  });

  it('does not release a lease taken over by a cross-instance resume when the origin suspended record expires', async () => {
    const originRuntime = new AgentThreadStreamRuntime();
    const resumeRuntime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const agent = { id: 'cross-instance-resume-agent' } as Agent<any, any, any, any>;
    const threadId = 'cross-instance-resume-thread';
    const resourceId = 'cross-instance-resume-user';
    const key = [resourceId, threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    const runId = 'cross-instance-resume-run';
    let dateNow: ReturnType<typeof vi.spyOn> | undefined;
    const subscription = await originRuntime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
    const iterator = subscription.stream[Symbol.asyncIterator]();

    try {
      let finishSuspended!: () => void;
      const suspendedFinished = new Promise<void>(resolve => {
        finishSuspended = resolve;
      });
      const suspendedOutput = {
        runId,
        status: 'running',
        fullStream: new ReadableStream({
          start(controller) {
            controller.enqueue({
              type: 'tool-call-approval',
              runId,
              payload: { toolCallId: 'approval-1', toolName: 'approveAction' },
            });
            controller.close();
          },
        }),
        _waitUntilFinished: () => suspendedFinished,
      } as any;

      setTimeout(() => {
        suspendedOutput.status = 'suspended';
        finishSuspended();
      }, 10);

      await originRuntime.registerRun(
        agent,
        suspendedOutput,
        { memory: { thread: threadId, resource: resourceId } } as any,
        pubsub,
      );
      await iterator.next();
      await waitForCondition(() => pubsub.publishedTypes.includes('run-suspended'));
      expect(originRuntime.getThreadState({ threadId, resourceId }, pubsub)).toBe('active');
      expect(pubsub.owners.get(key)).toBe(runId);

      let now = Date.now();
      dateNow = vi.spyOn(Date, 'now').mockImplementation(() => now);
      const resumedFinished = new Promise<void>(() => {});
      await resumeRuntime.registerRun(
        agent,
        {
          runId,
          status: 'running',
          fullStream: new ReadableStream(),
          _waitUntilFinished: () => resumedFinished,
        } as any,
        { memory: { thread: threadId, resource: resourceId }, resumeData: { approved: true } } as any,
        pubsub,
      );
      expect(pubsub.owners.get(key)).toBe(runId);

      const publishedBeforeSweep = pubsub.publishedTypes.length;
      now += Mastra.INTERNAL_WORKFLOW_TTL_MS + 1;
      await originRuntime.registerRun(
        { id: 'sweep-trigger-agent' } as Agent<any, any, any, any>,
        {
          runId: 'sweep-trigger-run',
          status: 'running',
          fullStream: new ReadableStream(),
          _waitUntilFinished: () => new Promise<void>(() => {}),
        } as any,
        { memory: { thread: 'sweep-trigger-thread', resource: resourceId } } as any,
        pubsub,
      );
      await pubsub.flush();

      expect(pubsub.releaseCalls).not.toContainEqual({ key, owner: runId });
      expect(pubsub.owners.get(key)).toBe(runId);
      expect(pubsub.publishedTypes.slice(publishedBeforeSweep)).not.toContain('run-completed');
    } finally {
      subscription.unsubscribe();
      dateNow?.mockRestore();
    }
  });

  it('fails strict registration closed without installing a ghost record', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const agent = { id: 'strict-conflict-agent' } as Agent<any, any, any, any>;
    const threadId = 'strict-conflict-thread';
    const resourceId = 'strict-conflict-resource';
    const key = [resourceId, threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    pubsub.owners.set(key, 'other-run');

    const register = () =>
      runtime.registerRun(
        agent,
        {
          runId: 'strict-conflict-run',
          status: 'running',
          fullStream: new ReadableStream(),
          _waitUntilFinished: () => new Promise<void>(() => {}),
        } as any,
        { memory: { thread: threadId, resource: resourceId } } as any,
        pubsub,
        { strict: true },
      )!;

    await expect(register()).rejects.toThrow('thread lease is held');
    expect(runtime.getThreadState({ threadId, resourceId }, pubsub)).toBe('idle');
    expect(pubsub.publishedTypes).not.toContain('run-registered');

    pubsub.owners.delete(key);
    pubsub.failAcquire = true;
    await expect(register()).rejects.toThrow('acquire failed');
    expect(runtime.getThreadState({ threadId, resourceId }, pubsub)).toBe('idle');
  });

  it('strict rollback removes only its registration and permits a new run', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const agent = { id: 'strict-rollback-agent' } as Agent<any, any, any, any>;
    const threadId = 'strict-rollback-thread';
    const resourceId = 'strict-rollback-resource';
    const key = [resourceId, threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    const neverFinishes = () => new Promise<void>(() => {});
    const register = (runId: string) =>
      runtime.registerRun(
        agent,
        { runId, status: 'running', fullStream: new ReadableStream(), _waitUntilFinished: neverFinishes } as any,
        { memory: { thread: threadId, resource: resourceId } } as any,
        pubsub,
        { strict: true },
      )!;

    const first = await register('strict-rollback-run-1');
    expect(runtime.getThreadState({ threadId, resourceId }, pubsub)).toBe('active');
    await first.rollback();
    expect(runtime.getThreadState({ threadId, resourceId }, pubsub)).toBe('idle');
    expect(pubsub.owners.get(key)).toBeUndefined();

    const second = await register('strict-rollback-run-2');
    expect(pubsub.owners.get(key)).toBe('strict-rollback-run-2');
    expect(runtime.getThreadState({ threadId, resourceId }, pubsub)).toBe('active');
    await second.rollback({ releaseLease: false });
    expect(runtime.getThreadState({ threadId, resourceId }, pubsub)).toBe('idle');
    expect(pubsub.owners.get(key)).toBe('strict-rollback-run-2');
    await pubsub.releaseLease(key, 'strict-rollback-run-2');
  });

  it('rolls strict registration back and releases its lease when publishing fails', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const agent = { id: 'strict-publish-agent' } as Agent<any, any, any, any>;
    const threadId = 'strict-publish-thread';
    const resourceId = 'strict-publish-resource';
    const key = [resourceId, threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    let streamPulled = false;
    pubsub.failPublish = true;

    const registered = runtime.registerRun(
      agent,
      {
        runId: 'strict-publish-run',
        status: 'running',
        fullStream: {
          getReader() {
            streamPulled = true;
            throw new Error('strict publish failure must not start the stream');
          },
        },
        _waitUntilFinished: () => new Promise<void>(() => {}),
      } as any,
      { memory: { thread: threadId, resource: resourceId } } as any,
      pubsub,
      { strict: true },
    )!;

    await expect(registered).rejects.toThrow('publish failed');
    expect(runtime.getThreadState({ threadId, resourceId }, pubsub)).toBe('idle');
    expect(pubsub.owners.get(key)).toBeUndefined();
    expect(streamPulled).toBe(false);
  });

  it('discards a delivered registration when its publish acknowledgement fails', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const observer = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const agent = { id: 'strict-ack-agent' } as Agent<any, any, any, any>;
    const threadId = 'strict-ack-thread';
    const resourceId = 'strict-ack-resource';
    const subscription = await observer.subscribeToThread(agent, { threadId, resourceId }, pubsub);
    pubsub.failPublishAfterDelivery = true;

    try {
      await expect(
        runtime.registerRun(
          agent,
          {
            runId: 'strict-ack-run',
            status: 'running',
            fullStream: new ReadableStream(),
            _waitUntilFinished: () => new Promise<void>(() => {}),
          } as any,
          { memory: { thread: threadId, resource: resourceId } } as any,
          pubsub,
          { strict: true },
        )!,
      ).rejects.toThrow('publish acknowledgement failed');
      await pubsub.flush();
      await waitForCondition(() => observer.getThreadState({ threadId, resourceId }, pubsub) === 'idle');
      expect(pubsub.publishedTypes).toEqual(['run-registered', 'run-discarded']);
    } finally {
      subscription.unsubscribe();
    }
  });
});

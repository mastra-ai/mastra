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
import type { LeaseRecord, LeaseRecordProvider } from '../../events/pubsub';
import type { EventCallback } from '../../events/types';
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

function createRun(runId: string) {
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

  return {
    output: {
      runId,
      status: 'running',
      fullStream,
      _waitUntilFinished: () => finished,
    } as any,
    finish,
  };
}

/**
 * Minimal in-memory pubsub that also implements LeaseProvider, mirroring
 * ControlledLeasePubSub in agent-signals.test.ts (copied, not imported, to
 * keep that file untouched).
 */
class ControlledLeasePubSub extends PubSub implements LeaseRecordProvider {
  owners = new Map<string, string>();
  records = new Map<string, LeaseRecord>();
  denyAcquire = false;
  failAcquire = false;
  failPublish = false;
  failPublishAfterDelivery = false;
  publishedTypes: string[] = [];
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

  async acquireLease(
    key: string,
    owner: string,
    _ttlMs?: number,
    metadata?: string,
  ): Promise<{ acquired: boolean; owner?: string }> {
    if (this.failAcquire) throw new Error('acquire failed');
    const current = this.owners.get(key);
    const currentRecord = this.records.get(key);
    if (this.denyAcquire || (current && (current !== owner || currentRecord?.metadata !== metadata))) {
      return { acquired: false, owner: current };
    }
    this.owners.set(key, owner);
    this.records.set(key, { owner, ...(metadata === undefined ? {} : { metadata }) });
    return { acquired: true, owner };
  }

  async getLeaseRecord(key: string): Promise<LeaseRecord | undefined> {
    const record = this.records.get(key);
    return record ? { ...record } : this.owners.get(key) ? { owner: this.owners.get(key)! } : undefined;
  }

  async getLeaseOwner(key: string): Promise<string | undefined> {
    return this.owners.get(key);
  }

  async releaseLease(key: string, owner: string, metadata?: string): Promise<void> {
    const record = await this.getLeaseRecord(key);
    if (record?.owner === owner && record.metadata === metadata) {
      this.owners.delete(key);
      this.records.delete(key);
    }
  }

  async renewLease(key: string, owner: string, _ttlMs?: number, metadata?: string): Promise<boolean> {
    const record = await this.getLeaseRecord(key);
    return record?.owner === owner && record.metadata === metadata;
  }

  async transferLease(
    key: string,
    fromOwner: string,
    toOwner: string,
    _ttlMs?: number,
    fromMetadata?: string,
    toMetadata?: string,
  ): Promise<boolean> {
    const record = await this.getLeaseRecord(key);
    if (record?.owner !== fromOwner || record.metadata !== fromMetadata) return false;
    this.owners.set(key, toOwner);
    this.records.set(key, { owner: toOwner, ...(toMetadata === undefined ? {} : { metadata: toMetadata }) });
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
    const run = createRun(runId);

    const registered = runtime.registerRun(
      agent,
      run.output,
      { memory: { thread: threadId, resource: resourceId } } as any,
      pubsub,
    );
    expect(registered).toBeDefined();
    await registered;

    // A plain (non-signal) run must own the cross-process thread lease once
    // registration settles. The owner is opaque; the logical run id is stored
    // as atomic metadata beside it.
    expect(pubsub.owners.get(key)).toMatch(/^mastra:agent-thread:v2:/);
    expect(pubsub.owners.get(key)).not.toBe(runId);
    expect(pubsub.records.get(key)?.metadata).toBe(runId);

    run.finish();
    // Release is fire-and-forget inside the completion watcher's finally —
    // poll rather than asserting immediately.
    await waitForCondition(() => pubsub.owners.get(key) === undefined);
  });

  it('migrates legacy owners and round-trips prefix-like unicode run ids without URI encoding', async () => {
    const firstRuntime = new AgentThreadStreamRuntime();
    const resumedRuntime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const agent = { id: 'lease-codec-agent' } as Agent<any, any, any, any>;
    const threadId = 'lease-codec-thread';
    const resourceId = 'lease-codec-user';
    const key = [resourceId, threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    const runId = `mastra:agent-thread:v1:4:test:not-a-token:%:${String.fromCharCode(0xd800)}:🚀`;
    const firstRun = createRun(runId);
    const resumedRun = createRun(runId);

    // A pre-upgrade runtime wrote the logical run id verbatim. Although this id
    // resembles the scoped prefix, its non-canonical suffix must remain opaque.
    pubsub.owners.set(key, runId);
    await firstRuntime.registerRun(
      agent,
      firstRun.output,
      { memory: { thread: threadId, resource: resourceId } } as any,
      pubsub,
    );
    const firstOwner = pubsub.owners.get(key);
    expect(firstOwner).toMatch(/^mastra:agent-thread:v2:/);
    expect(firstOwner).not.toBe(runId);
    expect(pubsub.records.get(key)?.metadata).toBe(runId);

    // A second runtime uses the atomic metadata to identify the exact logical
    // id, including the lone surrogate, and rotates it to its own holder token.
    await resumedRuntime.registerRun(
      agent,
      resumedRun.output,
      { memory: { thread: threadId, resource: resourceId } } as any,
      pubsub,
    );
    const resumedOwner = pubsub.owners.get(key);
    expect(resumedOwner).toMatch(/^mastra:agent-thread:v2:/);
    expect(resumedOwner).not.toBe(firstOwner);

    // Completion by the former holder cannot release the resumed holder's token.
    firstRun.finish();
    await firstRun.output._waitUntilFinished();
    await pubsub.flush();
    await nextTick();
    expect(pubsub.owners.get(key)).toBe(resumedOwner);
    resumedRun.finish();
    await waitForCondition(() => pubsub.owners.get(key) === undefined);
  });

  it('does not claim a canonical-looking legacy owner for its embedded run id', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const agent = { id: 'legacy-collision-agent' } as Agent<any, any, any, any>;
    const threadId = 'legacy-collision-thread';
    const resourceId = 'legacy-collision-user';
    const key = [resourceId, threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    const legacyRunId = 'mastra:agent-thread:v1:4:test:123e4567-e89b-42d3-a456-426614174000';
    const run = createRun('test');

    // A pre-upgrade process may have stored any arbitrary bare run id. The
    // canonical-looking prefix is not proof that it belongs to logical runId
    // `test`, so the new runtime must leave it untouched.
    pubsub.owners.set(key, legacyRunId);
    await runtime.registerRun(agent, run.output, { memory: { thread: threadId, resource: resourceId } } as any, pubsub);
    expect(pubsub.owners.get(key)).toBe(legacyRunId);
    expect(pubsub.records.get(key)?.metadata).toBeUndefined();
    run.finish();
    await run.output._waitUntilFinished();
    await pubsub.flush();
    await nextTick();
    expect(pubsub.owners.get(key)).toBe(legacyRunId);
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
    const secondOwner = pubsub.owners.get(key);
    expect(secondOwner).toMatch(/^mastra:agent-thread:v2:/);
    expect(pubsub.records.get(key)?.metadata).toBe('strict-rollback-run-2');
    expect(runtime.getThreadState({ threadId, resourceId }, pubsub)).toBe('active');
    await second.rollback({ releaseLease: false });
    expect(runtime.getThreadState({ threadId, resourceId }, pubsub)).toBe('idle');
    expect(pubsub.owners.get(key)).toBe(secondOwner);
    await pubsub.releaseLease(key, secondOwner!, 'strict-rollback-run-2');
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

  it('keeps a remote stream alive while scoped lease metadata identifies its logical run', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new ControlledLeasePubSub();
    const agent = { id: 'scoped-remote-agent' } as Agent<any, any, any, any>;
    const threadId = 'scoped-remote-thread';
    const resourceId = 'scoped-remote-resource';
    const key = [resourceId, threadId].join(AGENT_THREAD_KEY_SEPARATOR);
    const topic = `agent.thread-stream.${encodeURIComponent(key)}`;
    const runId = 'scoped-remote-run';
    const owner = 'mastra:agent-thread:v2:remote-runtime:logical-run-digest';
    pubsub.owners.set(key, owner);
    pubsub.records.set(key, { owner, metadata: runId });
    const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId }, pubsub);

    await pubsub.publish(topic, {
      type: 'run-registered',
      runId,
      data: { type: 'run-registered', runId, streamId: 'scoped-remote-stream', streamSeq: 1 },
    });
    await pubsub.flush();
    await waitForCondition(() => subscription.activeRunId() === runId);

    vi.useFakeTimers();
    try {
      await vi.advanceTimersByTimeAsync(15_000);
      expect(subscription.activeRunId()).toBe(runId);
    } finally {
      vi.useRealTimers();
      subscription.unsubscribe();
    }
  });
});

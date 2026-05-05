import { randomUUID } from 'node:crypto';

import type { RequestContext } from '../request-context';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../request-context';
import type { MastraModelOutput } from '../stream/base/output';
import type { Agent } from './agent';
import type { AgentExecutionOptions } from './agent.types';
import { createSignal, signalToMessage } from './signals';
import type { CreatedAgentSignal } from './signals';
import type {
  AgentSignal,
  AgentSubscribeToThreadOptions,
  AgentThreadSubscription,
  SendAgentSignalOptions,
} from './types';

const AGENT_THREAD_KEY_SEPARATOR = '\u0000';

type AgentThreadRunRecord<OUTPUT = unknown> = {
  agent: Agent<any, any, any, any>;
  output: MastraModelOutput<OUTPUT>;
  runId: string;
  threadId: string;
  resourceId?: string;
  streamOptions: AgentExecutionOptions<OUTPUT>;
};

type PreparedThreadRun = {
  abortController: AbortController;
  cleanup: () => void;
};

export class AgentThreadStreamRuntime {
  #threadRunsById = new Map<string, AgentThreadRunRecord<any>>();
  #threadKeysByRunId = new Map<string, string>();
  #activeThreadRunIds = new Map<string, string>();
  #threadRunSubscribers = new Map<string, Set<(run: AgentThreadRunRecord<any>) => void>>();
  #pendingSignalsByThread = new Map<string, CreatedAgentSignal[]>();
  #watchedThreadRunIds = new Set<string>();
  #preparedRunsById = new Map<string, PreparedThreadRun>();
  #abortedRunIds = new Set<string>();

  #threadKey(resourceId: string | undefined, threadId: string): string {
    return [resourceId ?? '', threadId].join(AGENT_THREAD_KEY_SEPARATOR);
  }

  #getThreadTarget(options?: { memory?: AgentExecutionOptions<any>['memory']; requestContext?: RequestContext }) {
    const thread = options?.memory?.thread;
    const threadId =
      (options?.requestContext?.get(MASTRA_THREAD_ID_KEY) as string | undefined) ||
      (typeof thread === 'string' ? thread : thread?.id);
    const resourceId =
      (options?.requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined) || options?.memory?.resource;

    return { threadId, resourceId };
  }

  prepareRunOptions<OUTPUT>(options: AgentExecutionOptions<OUTPUT>): AgentExecutionOptions<OUTPUT> {
    const { threadId } = this.#getThreadTarget(options);
    if (!threadId || !options.runId) return options;

    const abortController = new AbortController();
    const upstreamAbortSignal = options.abortSignal;
    const abort = () => abortController.abort();
    if (upstreamAbortSignal?.aborted) {
      abort();
    } else {
      upstreamAbortSignal?.addEventListener('abort', abort, { once: true });
    }

    this.#preparedRunsById.set(options.runId, {
      abortController,
      cleanup: () => upstreamAbortSignal?.removeEventListener('abort', abort),
    });

    if (this.#abortedRunIds.has(options.runId)) {
      abort();
    }

    return {
      ...options,
      abortSignal: abortController.signal,
    };
  }

  abortRun(runId: string): boolean {
    const preparedRun = this.#preparedRunsById.get(runId);
    if (!preparedRun) {
      this.#abortedRunIds.add(runId);
      return false;
    }

    preparedRun.abortController.abort();
    this.#abortedRunIds.add(runId);
    return true;
  }

  abortThread(options: AgentSubscribeToThreadOptions): boolean {
    const key = this.#threadKey(options.resourceId, options.threadId);
    const activeRunId = this.#activeThreadRunIds.get(key);
    if (!activeRunId) return false;
    return this.abortRun(activeRunId);
  }

  #cleanupPreparedRun(runId: string) {
    this.#preparedRunsById.get(runId)?.cleanup();
    this.#preparedRunsById.delete(runId);
    this.#abortedRunIds.delete(runId);
  }

  #notifyThreadRun(record: AgentThreadRunRecord<any>) {
    const key = this.#threadKey(record.resourceId, record.threadId);
    this.#threadRunSubscribers.get(key)?.forEach(listener => listener(record));
  }

  registerRun<OUTPUT>(
    agent: Agent<any, any, any, any>,
    output: MastraModelOutput<OUTPUT>,
    streamOptions: AgentExecutionOptions<OUTPUT>,
  ) {
    const { threadId, resourceId } = this.#getThreadTarget(streamOptions);
    if (!threadId) return;

    const key = this.#threadKey(resourceId, threadId);
    const record: AgentThreadRunRecord<OUTPUT> = {
      agent,
      output,
      runId: output.runId,
      threadId,
      resourceId,
      streamOptions: streamOptions as AgentThreadRunRecord<OUTPUT>['streamOptions'],
    };

    this.#threadRunsById.set(output.runId, record);
    this.#threadKeysByRunId.set(output.runId, key);
    this.#activeThreadRunIds.set(key, output.runId);
    this.#notifyThreadRun(record);
    this.#watchThreadRunCompletion(key, record);
  }

  #watchThreadRunCompletion(key: string, record: AgentThreadRunRecord<any>) {
    if (this.#watchedThreadRunIds.has(record.runId)) return;
    this.#watchedThreadRunIds.add(record.runId);

    void record.output.getFullOutput().finally(() => {
      this.#watchedThreadRunIds.delete(record.runId);
      this.#threadRunsById.delete(record.runId);
      this.#threadKeysByRunId.delete(record.runId);
      this.#cleanupPreparedRun(record.runId);
      if (this.#activeThreadRunIds.get(key) === record.runId) {
        this.#activeThreadRunIds.delete(key);
      }
      void this.#drainPendingSignals(key, record);
    });
  }

  async #drainPendingSignals(key: string, previousRun: AgentThreadRunRecord<any>) {
    if (this.#activeThreadRunIds.has(key)) return;

    const queue = this.#pendingSignalsByThread.get(key);
    if (!queue) return;
    const signal = queue.shift();
    if (!signal) return;
    if (queue.length === 0) {
      this.#pendingSignalsByThread.delete(key);
    }

    const output = (await (previousRun.agent.stream as any)(signalToMessage(signal), {
      ...previousRun.streamOptions,
      runId: randomUUID(),
      memory:
        previousRun.streamOptions.memory ?? ({ resource: previousRun.resourceId, thread: previousRun.threadId } as any),
    })) as MastraModelOutput<any>;

    if (queue.length > 0) {
      const nextRecord = this.#threadRunsById.get(output.runId);
      if (nextRecord) {
        this.#watchThreadRunCompletion(key, nextRecord);
      }
    }
  }

  drainPendingSignals(runId: string) {
    const record = this.#threadRunsById.get(runId);
    const key = record ? this.#threadKey(record.resourceId, record.threadId) : this.#threadKeysByRunId.get(runId);
    if (!key) return [];

    const queue = this.#pendingSignalsByThread.get(key);
    if (!queue || queue.length === 0) return [];

    this.#pendingSignalsByThread.delete(key);
    return queue;
  }

  async waitForCrossAgentThreadRun(
    agent: Agent<any, any, any, any>,
    options: { memory?: AgentExecutionOptions<any>['memory']; requestContext?: RequestContext },
  ) {
    const { threadId, resourceId } = this.#getThreadTarget(options);
    if (!threadId) return;

    const key = this.#threadKey(resourceId, threadId);
    while (true) {
      const activeRunId = this.#activeThreadRunIds.get(key);
      const activeRecord = activeRunId ? this.#threadRunsById.get(activeRunId) : undefined;
      if (!activeRecord || activeRecord.agent.id === agent.id || activeRecord.output.status !== 'running') return;
      await activeRecord.output.getFullOutput().catch(() => {});
    }
  }

  async subscribeToThread<OUTPUT = unknown>(
    agent: Agent<any, any, any, any>,
    options: AgentSubscribeToThreadOptions,
  ): Promise<AgentThreadSubscription<OUTPUT>> {
    void agent;
    const key = this.#threadKey(options.resourceId, options.threadId);
    const seenRunIds = new Set<string>();
    const pendingRuns: AgentThreadRunRecord<any>[] = [];
    const waiters: Array<() => void> = [];
    let done = false;

    const wake = () => {
      while (waiters.length) waiters.shift()?.();
    };

    const activeRunId = () => {
      const runId = this.#activeThreadRunIds.get(key);
      if (!runId) return null;
      const record = this.#threadRunsById.get(runId);
      if (!record) return runId;
      return record.output.status === 'running' ? runId : null;
    };

    const enqueueRun = (record: AgentThreadRunRecord<any>) => {
      if (done || seenRunIds.has(record.runId)) return;
      seenRunIds.add(record.runId);
      pendingRuns.push(record);
      wake();
    };

    const listeners = this.#threadRunSubscribers.get(key) ?? new Set<(run: AgentThreadRunRecord<any>) => void>();
    listeners.add(enqueueRun);
    this.#threadRunSubscribers.set(key, listeners);

    const currentRunId = activeRunId();
    const currentRecord = currentRunId ? this.#threadRunsById.get(currentRunId) : undefined;
    if (currentRecord) {
      enqueueRun(currentRecord);
    }

    const unsubscribe = () => {
      if (done) return;
      done = true;
      listeners.delete(enqueueRun);
      if (listeners.size === 0) {
        this.#threadRunSubscribers.delete(key);
      }
      wake();
    };

    return {
      activeRunId,
      abort: () => this.abortThread(options),
      unsubscribe,
      stream: (async function* () {
        try {
          while (!done || pendingRuns.length > 0) {
            if (pendingRuns.length === 0) {
              await new Promise<void>(resolve => waiters.push(resolve));
              continue;
            }
            const run = pendingRuns.shift()!;
            for await (const part of run.output.fullStream) {
              yield part as any;
              if (done) break;
            }
          }
        } finally {
          unsubscribe();
        }
      })(),
    };
  }

  sendSignal<OUTPUT = unknown>(
    agent: Agent<any, any, any, any>,
    signalInput: AgentSignal,
    target: SendAgentSignalOptions<OUTPUT>,
  ): { accepted: true; runId: string; signal: CreatedAgentSignal } {
    const signal = createSignal(signalInput);
    let key: string | undefined;
    let runId = target.runId;

    let activeRecord: AgentThreadRunRecord<any> | undefined;
    if (target.resourceId && target.threadId) {
      key = this.#threadKey(target.resourceId, target.threadId);
      const activeRunId = this.#activeThreadRunIds.get(key);
      activeRecord = activeRunId ? this.#threadRunsById.get(activeRunId) : undefined;
      if (activeRecord && activeRecord.output.status !== 'running') {
        this.#activeThreadRunIds.delete(key);
        activeRecord = undefined;
      }
      if (activeRecord && activeRecord.agent.id === agent.id) {
        runId = activeRecord.runId;
      }
    }

    if (runId) {
      activeRecord ??= this.#threadRunsById.get(runId);
      if (activeRecord?.output.status === 'running') {
        key ??= this.#threadKey(activeRecord.resourceId, activeRecord.threadId);
        if (activeRecord.agent.id === agent.id) {
          const queue = this.#pendingSignalsByThread.get(key) ?? [];
          queue.push(signal);
          this.#pendingSignalsByThread.set(key, queue);
          this.#watchThreadRunCompletion(key, activeRecord);
          return { accepted: true, runId, signal };
        }
      }

      if (key && this.#activeThreadRunIds.get(key) === runId) {
        const queue = this.#pendingSignalsByThread.get(key) ?? [];
        queue.push(signal);
        this.#pendingSignalsByThread.set(key, queue);
        return { accepted: true, runId, signal };
      }
    }

    const resourceId = target.resourceId ?? activeRecord?.resourceId;
    const threadId = target.threadId ?? activeRecord?.threadId;
    if (!threadId) {
      throw new Error('No active agent run found for signal target');
    }
    if (!target.ifIdle) {
      throw new Error('No active agent run found for signal target');
    }

    runId = randomUUID();
    key ??= this.#threadKey(resourceId, threadId);
    if (!this.#activeThreadRunIds.has(key)) {
      this.#activeThreadRunIds.set(key, runId);
      this.#threadKeysByRunId.set(runId, key);
    }
    void (agent.stream as any)(signalToMessage(signal), {
      ...target.ifIdle.streamOptions,
      runId,
      memory: target.ifIdle.streamOptions.memory ?? ({ resource: resourceId, thread: threadId } as any),
      _initialSignalEchoes: [signal],
    }).catch(() => {
      this.#threadKeysByRunId.delete(runId);
      if (this.#activeThreadRunIds.get(key) === runId) {
        this.#activeThreadRunIds.delete(key);
      }
    });

    return { accepted: true, runId, signal };
  }
}

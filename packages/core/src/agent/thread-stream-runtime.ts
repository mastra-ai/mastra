import { randomUUID } from 'node:crypto';

import type { RequestContext } from '../request-context';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../request-context';
import type { MastraModelOutput } from '../stream/base/output';
import type { Agent } from './agent';
import type { AgentExecutionOptions } from './agent.types';
import { signalToMessage } from './signals';
import type {
  AgentSignal,
  AgentSubscribeToThreadOptions,
  AgentThreadRun,
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

export class AgentThreadStreamRuntime {
  #threadRunsById = new Map<string, AgentThreadRunRecord<any>>();
  #activeThreadRunIds = new Map<string, string>();
  #threadRunSubscribers = new Map<string, Set<(run: AgentThreadRunRecord<any>) => void>>();
  #pendingSignalsByThread = new Map<string, AgentSignal[]>();
  #watchedThreadRunIds = new Set<string>();

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

  #toAgentThreadRun<OUTPUT>(record: AgentThreadRunRecord<OUTPUT>): AgentThreadRun<OUTPUT> {
    return {
      output: record.output,
      get fullStream() {
        return record.output.fullStream as ReadableStream<any>;
      },
      runId: record.runId,
      threadId: record.threadId,
      resourceId: record.resourceId,
      cleanup: () => {},
    };
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
    const pendingRuns: AgentThreadRun<OUTPUT>[] = [];
    const waiters: Array<() => void> = [];
    let done = false;

    const wake = () => {
      while (waiters.length) waiters.shift()?.();
    };

    const enqueueRun = (record: AgentThreadRunRecord<any>) => {
      if (done || seenRunIds.has(record.runId)) return;
      seenRunIds.add(record.runId);
      pendingRuns.push(this.#toAgentThreadRun(record) as AgentThreadRun<OUTPUT>);
      wake();
    };

    const listeners = this.#threadRunSubscribers.get(key) ?? new Set<(run: AgentThreadRunRecord<any>) => void>();
    listeners.add(enqueueRun);
    this.#threadRunSubscribers.set(key, listeners);

    const cleanup = () => {
      if (done) return;
      done = true;
      listeners.delete(enqueueRun);
      if (listeners.size === 0) {
        this.#threadRunSubscribers.delete(key);
      }
      wake();
    };

    return {
      cleanup,
      runs: (async function* () {
        try {
          while (!done || pendingRuns.length > 0) {
            if (pendingRuns.length === 0) {
              await new Promise<void>(resolve => waiters.push(resolve));
              continue;
            }
            yield pendingRuns.shift()!;
          }
        } finally {
          cleanup();
        }
      })(),
    };
  }

  sendSignal<OUTPUT = unknown>(
    agent: Agent<any, any, any, any>,
    signal: AgentSignal,
    target: SendAgentSignalOptions<OUTPUT>,
  ): { accepted: true; runId: string } {
    let key: string | undefined;
    let runId = target.runId;

    let activeRecord: AgentThreadRunRecord<any> | undefined;
    if (target.resourceId && target.threadId) {
      key = this.#threadKey(target.resourceId, target.threadId);
      const activeRunId = this.#activeThreadRunIds.get(key);
      activeRecord = activeRunId ? this.#threadRunsById.get(activeRunId) : undefined;
      if (activeRecord?.output.status !== 'running') {
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
          return { accepted: true, runId };
        }
      }
    }

    const resourceId = target.resourceId ?? activeRecord?.resourceId;
    const threadId = target.threadId ?? activeRecord?.threadId;
    if (!threadId) {
      throw new Error('No active agent run found for signal target');
    }

    runId = randomUUID();
    void (agent.stream as any)(signalToMessage(signal), {
      ...(target.streamOptions as AgentExecutionOptions<OUTPUT> | undefined),
      runId,
      memory: target.streamOptions?.memory ?? ({ resource: resourceId, thread: threadId } as any),
    });

    return { accepted: true, runId };
  }
}

import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/request-context';

import { omDebug } from './debug';
import type { ModelByInputTokens } from './model-by-input-tokens';
import {
  buildObserverSystemPrompt,
  buildObserverTaskPrompt,
  buildObserverHistoryMessage,
  buildMultiThreadObserverTaskPrompt,
  buildMultiThreadObserverHistoryMessage,
  parseObserverOutput,
  parseMultiThreadObserverOutput,
} from './observer-agent';
import type { ResolvedObservationConfig } from './types';

type ConcreteObservationModel = Exclude<ResolvedObservationConfig['model'], ModelByInputTokens>;

/**
 * Runs the Observer agent for extracting observations from messages.
 * Handles single-thread and multi-thread modes, degenerate detection, and retry logic.
 */
export class ObserverRunner {
  private readonly observationConfig: ResolvedObservationConfig;
  private readonly observedMessageIds: Set<string>;
  private observerAgent?: Agent;

  constructor(opts: { observationConfig: ResolvedObservationConfig; observedMessageIds: Set<string> }) {
    this.observationConfig = opts.observationConfig;
    this.observedMessageIds = opts.observedMessageIds;
  }

  private createAgent(model: ConcreteObservationModel, isMultiThread = false): Agent {
    return new Agent({
      id: isMultiThread ? 'multi-thread-observer' : 'observational-memory-observer',
      name: isMultiThread ? 'multi-thread-observer' : 'Observer',
      instructions: buildObserverSystemPrompt(
        isMultiThread,
        this.observationConfig.instruction,
        this.observationConfig.threadTitle,
      ),
      model,
    });
  }

  private getAgent(model: ConcreteObservationModel): Agent {
    this.observerAgent ??= this.createAgent(model);
    return this.observerAgent;
  }

  private async withAbortCheck<T>(fn: () => Promise<T>, abortSignal?: AbortSignal): Promise<T> {
    if (abortSignal?.aborted) {
      throw new Error('The operation was aborted.');
    }
    const result = await fn();
    if (abortSignal?.aborted) {
      throw new Error('The operation was aborted.');
    }
    return result;
  }

  /**
   * Call the Observer agent for a single thread.
   */
  async call(
    existingObservations: string | undefined,
    messagesToObserve: MastraDBMessage[],
    abortSignal?: AbortSignal,
    options?: {
      skipContinuationHints?: boolean;
      requestContext?: RequestContext;
      priorCurrentTask?: string;
      priorSuggestedResponse?: string;
      priorThreadTitle?: string;
      wasTruncated?: boolean;
      model?: ConcreteObservationModel;
    },
  ): Promise<{
    observations: string;
    currentTask?: string;
    suggestedContinuation?: string;
    threadTitle?: string;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }> {
    const agent = options?.model
      ? this.createAgent(options.model)
      : this.getAgent(this.observationConfig.model as ConcreteObservationModel);

    const observerMessages = [
      {
        role: 'user' as const,
        content: buildObserverTaskPrompt(existingObservations, {
          ...options,
          includeThreadTitle: this.observationConfig.threadTitle,
        }),
      },
      buildObserverHistoryMessage(messagesToObserve),
    ];

    const doGenerate = async () => {
      return this.withAbortCheck(async () => {
        const streamResult = await agent.stream(observerMessages, {
          modelSettings: { ...this.observationConfig.modelSettings },
          providerOptions: this.observationConfig.providerOptions as any,
          ...(abortSignal ? { abortSignal } : {}),
          ...(options?.requestContext ? { requestContext: options.requestContext } : {}),
        });
        return streamResult.getFullOutput();
      }, abortSignal);
    };

    let result = await doGenerate();
    let parsed = parseObserverOutput(result.text);

    if (parsed.degenerate) {
      omDebug(`[OM:callObserver] degenerate repetition detected, retrying once`);
      result = await doGenerate();
      parsed = parseObserverOutput(result.text);
      if (parsed.degenerate) {
        omDebug(`[OM:callObserver] degenerate repetition on retry, failing`);
        throw new Error('Observer produced degenerate output after retry');
      }
    }

    const usage = result.totalUsage ?? result.usage;

    return {
      observations: parsed.observations,
      currentTask: parsed.currentTask,
      suggestedContinuation: parsed.suggestedContinuation,
      threadTitle: parsed.threadTitle,
      usage: usage
        ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens }
        : undefined,
    };
  }

  /**
   * Call the Observer agent for multiple threads in a single batched request.
   */
  async callMultiThread(
    existingObservations: string | undefined,
    messagesByThread: Map<string, MastraDBMessage[]>,
    threadOrder: string[],
    abortSignal?: AbortSignal,
    requestContext?: RequestContext,
    priorMetadataByThread?: Map<string, { currentTask?: string; suggestedResponse?: string; threadTitle?: string }>,
    model?: ConcreteObservationModel,
  ): Promise<{
    results: Map<
      string,
      { observations: string; currentTask?: string; suggestedContinuation?: string; threadTitle?: string }
    >;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }> {
    const agent = this.createAgent(model ?? (this.observationConfig.model as ConcreteObservationModel), true);

    const observerMessages = [
      {
        role: 'user' as const,
        content: buildMultiThreadObserverTaskPrompt(
          existingObservations,
          threadOrder,
          priorMetadataByThread,
          undefined,
          this.observationConfig.threadTitle,
        ),
      },
      buildMultiThreadObserverHistoryMessage(messagesByThread, threadOrder),
    ];

    // Mark all messages as observed
    for (const msgs of messagesByThread.values()) {
      for (const msg of msgs) {
        this.observedMessageIds.add(msg.id);
      }
    }

    const doGenerate = async () => {
      return this.withAbortCheck(async () => {
        const streamResult = await agent.stream(observerMessages, {
          modelSettings: { ...this.observationConfig.modelSettings },
          providerOptions: this.observationConfig.providerOptions as any,
          ...(abortSignal ? { abortSignal } : {}),
          ...(requestContext ? { requestContext } : {}),
        });
        return streamResult.getFullOutput();
      }, abortSignal);
    };

    let result = await doGenerate();
    let parsed = parseMultiThreadObserverOutput(result.text);

    if (parsed.degenerate) {
      omDebug(`[OM:callMultiThreadObserver] degenerate repetition detected, retrying once`);
      result = await doGenerate();
      parsed = parseMultiThreadObserverOutput(result.text);
      if (parsed.degenerate) {
        omDebug(`[OM:callMultiThreadObserver] degenerate repetition on retry, failing`);
        throw new Error('Multi-thread observer produced degenerate output after retry');
      }
    }

    const results = new Map<
      string,
      { observations: string; currentTask?: string; suggestedContinuation?: string; threadTitle?: string }
    >();
    for (const [threadId, threadResult] of parsed.threads) {
      results.set(threadId, {
        observations: threadResult.observations,
        currentTask: threadResult.currentTask,
        suggestedContinuation: threadResult.suggestedContinuation,
        threadTitle: threadResult.threadTitle,
      });
    }

    // Add empty results for threads that didn't get output
    for (const threadId of threadOrder) {
      if (!results.has(threadId)) {
        results.set(threadId, { observations: '' });
      }
    }

    const usage = result.totalUsage ?? result.usage;

    return {
      results,
      usage: usage
        ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens }
        : undefined,
    };
  }
}

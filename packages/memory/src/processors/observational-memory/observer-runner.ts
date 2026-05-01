import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { ObservabilityContext } from '@mastra/core/observability';
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
import type { TokenCounter } from './token-counter';
import { withOmTracingSpan } from './tracing';
import type { ResolvedObservationConfig } from './types';

type ConcreteObservationModel = Exclude<ResolvedObservationConfig['model'], ModelByInputTokens>;

type ObservationModelResolver = (inputTokens: number) => {
  model: ConcreteObservationModel;
  selectedThreshold?: number;
  routingStrategy?: 'model-by-input-tokens';
  routingThresholds?: string;
};

/**
 * Runs the Observer agent for extracting observations from messages.
 * Handles single-thread and multi-thread modes, degenerate detection, and retry logic.
 */
export interface ObserverExchange {
  systemPrompt: string;
  observerMessages: Array<{ role: string; content: unknown }>;
  rawOutput: string;
  parsedResult: {
    observations: string;
    currentTask?: string;
    suggestedContinuation?: string;
    threadTitle?: string;
    degenerate?: boolean;
  };
  model: string;
  inputTokens: number;
  isMultiThread: boolean;
  retriedDueToDegenerate: boolean;
}

export class ObserverRunner {
  private readonly observationConfig: ResolvedObservationConfig;
  private readonly observedMessageIds: Set<string>;
  private readonly resolveModel: ObservationModelResolver;
  private readonly tokenCounter: TokenCounter;

  /** Captured prompt/response from the last observer call (for repro capture). */
  lastExchange?: ObserverExchange;

  constructor(opts: {
    observationConfig: ResolvedObservationConfig;
    observedMessageIds: Set<string>;
    resolveModel: ObservationModelResolver;
    tokenCounter: TokenCounter;
  }) {
    this.observationConfig = opts.observationConfig;
    this.observedMessageIds = opts.observedMessageIds;
    this.resolveModel = opts.resolveModel;
    this.tokenCounter = opts.tokenCounter;
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
      observabilityContext?: ObservabilityContext;
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
    const inputTokens = this.tokenCounter.countMessages(messagesToObserve);
    const resolvedModel = options?.model ? { model: options.model } : this.resolveModel(inputTokens);
    const agent = this.createAgent(resolvedModel.model);

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
      return withOmTracingSpan({
        phase: 'observer',
        model: resolvedModel.model,
        inputTokens,
        requestContext: options?.requestContext,
        observabilityContext: options?.observabilityContext,
        metadata: {
          omPreviousObserverTokens: this.observationConfig.previousObserverTokens,
          omThreadTitleEnabled: this.observationConfig.threadTitle,
          omSkipContinuationHints: options?.skipContinuationHints ?? false,
          omWasTruncated: options?.wasTruncated ?? false,
          ...(resolvedModel.selectedThreshold !== undefined
            ? { omSelectedThreshold: resolvedModel.selectedThreshold }
            : {}),
          ...(resolvedModel.routingStrategy ? { omRoutingStrategy: resolvedModel.routingStrategy } : {}),
          ...(resolvedModel.routingThresholds ? { omRoutingThresholds: resolvedModel.routingThresholds } : {}),
        },
        callback: childObservabilityContext =>
          this.withAbortCheck(async () => {
            const streamResult = await agent.stream(observerMessages, {
              modelSettings: { ...this.observationConfig.modelSettings },
              providerOptions: this.observationConfig.providerOptions as any,
              ...(abortSignal ? { abortSignal } : {}),
              ...(options?.requestContext ? { requestContext: options.requestContext } : {}),
              ...childObservabilityContext,
            });
            return streamResult.getFullOutput();
          }, abortSignal),
      });
    };

    let result = await doGenerate();
    let parsed = parseObserverOutput(result.text);
    let retriedDueToDegenerate = false;

    if (parsed.degenerate) {
      omDebug(`[OM:callObserver] degenerate repetition detected, retrying once`);
      result = await doGenerate();
      parsed = parseObserverOutput(result.text);
      retriedDueToDegenerate = true;
      if (parsed.degenerate) {
        omDebug(`[OM:callObserver] degenerate repetition on retry, failing`);
        throw new Error('Observer produced degenerate output after retry');
      }
    }

    const systemPrompt = buildObserverSystemPrompt(
      false,
      this.observationConfig.instruction,
      this.observationConfig.threadTitle,
    );
    this.lastExchange = {
      systemPrompt,
      observerMessages,
      rawOutput: result.text,
      parsedResult: {
        observations: parsed.observations,
        currentTask: parsed.currentTask,
        suggestedContinuation: parsed.suggestedContinuation,
        threadTitle: parsed.threadTitle,
        degenerate: parsed.degenerate,
      },
      model: String(resolvedModel.model),
      inputTokens,
      isMultiThread: false,
      retriedDueToDegenerate,
    };

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
    observabilityContext?: ObservabilityContext,
    model?: ConcreteObservationModel,
  ): Promise<{
    results: Map<
      string,
      { observations: string; currentTask?: string; suggestedContinuation?: string; threadTitle?: string }
    >;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }> {
    const inputTokens = Array.from(messagesByThread.values()).reduce(
      (total, messages) => total + this.tokenCounter.countMessages(messages),
      0,
    );
    const resolvedModel = model ? { model } : this.resolveModel(inputTokens);
    const agent = this.createAgent(resolvedModel.model, true);

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
      return withOmTracingSpan({
        phase: 'observer-multi-thread',
        model: resolvedModel.model,
        inputTokens,
        requestContext,
        observabilityContext,
        metadata: {
          omThreadCount: threadOrder.length,
          omPreviousObserverTokens: this.observationConfig.previousObserverTokens,
          omThreadTitleEnabled: this.observationConfig.threadTitle,
          ...(resolvedModel.selectedThreshold !== undefined
            ? { omSelectedThreshold: resolvedModel.selectedThreshold }
            : {}),
          ...(resolvedModel.routingStrategy ? { omRoutingStrategy: resolvedModel.routingStrategy } : {}),
          ...(resolvedModel.routingThresholds ? { omRoutingThresholds: resolvedModel.routingThresholds } : {}),
        },
        callback: childObservabilityContext =>
          this.withAbortCheck(async () => {
            const streamResult = await agent.stream(observerMessages, {
              modelSettings: { ...this.observationConfig.modelSettings },
              providerOptions: this.observationConfig.providerOptions as any,
              ...(abortSignal ? { abortSignal } : {}),
              ...(requestContext ? { requestContext } : {}),
              ...childObservabilityContext,
            });
            return streamResult.getFullOutput();
          }, abortSignal),
      });
    };

    let result = await doGenerate();
    let parsed = parseMultiThreadObserverOutput(result.text);
    let retriedDueToDegenerate = false;

    if (parsed.degenerate) {
      omDebug(`[OM:callMultiThreadObserver] degenerate repetition detected, retrying once`);
      result = await doGenerate();
      parsed = parseMultiThreadObserverOutput(result.text);
      retriedDueToDegenerate = true;
      if (parsed.degenerate) {
        omDebug(`[OM:callMultiThreadObserver] degenerate repetition on retry, failing`);
        throw new Error('Multi-thread observer produced degenerate output after retry');
      }
    }

    const systemPrompt = buildObserverSystemPrompt(
      true,
      this.observationConfig.instruction,
      this.observationConfig.threadTitle,
    );
    this.lastExchange = {
      systemPrompt,
      observerMessages,
      rawOutput: result.text,
      parsedResult: {
        observations: Array.from(parsed.threads.values())
          .map(t => t.observations)
          .join('\n'),
        threadTitle: Array.from(parsed.threads.values())
          .map(t => t.threadTitle)
          .filter(Boolean)
          .join(', '),
        degenerate: parsed.degenerate,
      },
      model: String(resolvedModel.model),
      inputTokens,
      isMultiThread: true,
      retriedDueToDegenerate,
    };

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

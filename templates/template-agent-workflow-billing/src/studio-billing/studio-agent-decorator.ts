import { Agent } from '@mastra/core/agent';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { AnyAgent } from '../billing/mastra-resources.js';
import { BillingError, identifierSchema } from '../billing/contracts/core.js';
import type { StudioBillingIntegration, StudioConversation } from './studio-wrapper-contracts.js';

interface Finalization {
  readonly run: () => Promise<void>;
  pending?: Promise<void>;
  onSettled?: () => void;
}
/** Trusted association survives native queued/idle stream re-entry without editable RequestContext. */
export class StudioAgentRuntime {
  private readonly approving = new AsyncLocalStorage<boolean>();
  readonly request = new AsyncLocalStorage<StudioConversation>();
  private readonly threads = new Map<string, StudioConversation>();
  private readonly finalizations = new Map<string, Finalization>();
  readonly subscriptions = new Map<string, symbol>();
  private readonly decorated = new WeakMap<object, string>();
  readonly agents: Record<string, AnyAgent> = Object.create(null);
  readonly aliases = new Map<string, string>();
  readonly ordinaryAgents = new Set<string>();
  approval?: (
    conversation: StudioConversation,
    toolCallId: string,
    approved: boolean,
  ) => Promise<{ replayed: boolean; runId: string; declineReason?: string }>;
  constructor(readonly integration: StudioBillingIntegration) {}
  requestLocal(conversation: StudioConversation) {
    const previous = this.threads.get(conversation.owner.threadId);
    return previous && !previous.controller.signal.aborted
      ? { ...conversation, controller: previous.controller }
      : conversation;
  }
  bind(conversation: StudioConversation, fresh = false) {
    const active = fresh ? conversation : this.requestLocal(conversation);
    this.threads.set(active.owner.threadId, active);
    return active;
  }

  /** Retire only the subscription and conversation that owned the completed stream. */
  async release(conversation: StudioConversation, subscription: symbol) {
    const { threadId } = conversation.owner;
    if (this.subscriptions.get(threadId) !== subscription) return;
    const forget = () => {
      if (this.subscriptions.get(threadId) !== subscription) return;
      this.subscriptions.delete(threadId);
      if (this.threads.get(threadId)?.controller === conversation.controller) this.threads.delete(threadId);
    };
    const finalization = this.finalizations.get(threadId);
    if (finalization) {
      const previous = finalization.onSettled;
      finalization.onSettled = () => {
        previous?.();
        forget();
      };
    }
    await this.settled(threadId);
    forget();
  }
  current() {
    const conversation = this.request.getStore();
    if (!conversation) throw new BillingError('unauthenticated');
    conversation.controller.signal.throwIfAborted();
    return conversation;
  }
  stop(conversation: StudioConversation, agent: AnyAgent, expectedRunId?: string) {
    if (this.threads.get(conversation.owner.threadId)?.controller !== conversation.controller) return false;
    if (
      expectedRunId &&
      agent.getActiveThreadRunId({
        threadId: conversation.owner.threadId,
        resourceId: conversation.owner.resourceId,
      }) !== expectedRunId
    )
      return false;
    return agent.abortThreadStream({
      threadId: conversation.owner.threadId,
      resourceId: conversation.owner.resourceId,
      clearPendingSignals: true,
      ...(expectedRunId ? { expectedRunId } : {}),
    });
  }
  /** Wait for durable conversational cleanup before acknowledging Stop or reloading history. */
  async settled(threadId: string) {
    const finalization = this.finalizations.get(threadId);
    if (!finalization) return;
    await this.finish(finalization);
    if (this.finalizations.get(threadId) === finalization) this.finalizations.delete(threadId);
    else await this.settled(threadId);
  }
  private async finish(finalization: Finalization) {
    const pending = (finalization.pending ??= finalization.run());
    try {
      await pending;
      finalization.onSettled?.();
    } catch (error) {
      if (finalization.pending === pending) finalization.pending = undefined;
      throw error;
    }
  }
  private finalizeStopped(conversation: StudioConversation, runId?: string) {
    const { threadId, resourceId, agentId } = conversation.owner;
    const previous = this.finalizations.get(threadId);
    const finalization: Finalization = {
      onSettled: () => {
        if (!this.subscriptions.has(threadId) && this.threads.get(threadId)?.controller === conversation.controller)
          this.threads.delete(threadId);
      },
      run: async () => {
        if (previous) await this.finish(previous);
        const memory = await this.agents[agentId].getMemory();
        if (!memory) throw new BillingError('state_unavailable');
        const thread = await memory.getThreadById({ threadId });
        if (!thread) return;
        if (thread.resourceId !== resourceId) throw new BillingError('forbidden');
        const { messages } = await memory.recall({ threadId, resourceId, perPage: 100 });
        const latest = messages
          .filter(message => message.role === 'assistant')
          .reduce<(typeof messages)[number] | undefined>(
            (latest, message) =>
              !latest || new Date(message.createdAt).getTime() >= new Date(latest.createdAt).getTime()
                ? message
                : latest,
            undefined,
          );
        const changed = messages.flatMap(message => {
          if (message.role !== 'assistant') return [];
          const metadata = { ...message.content.metadata };
          const ids = new Set<string>();
          const otherRuns = new Set<string>();
          for (const key of ['pendingToolApprovals', 'suspendedTools']) {
            const entries = metadata[key];
            if (!entries || typeof entries !== 'object' || Array.isArray(entries)) continue;
            const remaining = { ...entries } as Record<string, unknown>;
            for (const [id, value] of Object.entries(remaining)) {
              const entry = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
              if (!runId || !entry.runId || entry.runId === runId) {
                ids.add(id);
                delete remaining[id];
              } else otherRuns.add(id);
            }
            if (Object.keys(remaining).length) metadata[key] = remaining;
            else delete metadata[key];
          }
          const parts = message.content.parts.flatMap(part => {
            if (part.type === 'tool-invocation') {
              const tool = part.toolInvocation;
              const pending = ['call', 'partial-call', 'approval-requested', 'approval-responded'].includes(tool.state);
              if (pending && (ids.has(tool.toolCallId) || (message === latest && !otherRuns.has(tool.toolCallId)))) {
                ids.add(tool.toolCallId);
                const { approval: _approval, result: _result, ...invocation } = tool;
                return [
                  {
                    ...part,
                    updatedAt: Date.now(),
                    toolInvocation: {
                      ...invocation,
                      state: 'output-error' as const,
                      isError: true,
                      errorText: 'Conversation stopped. Query saved business operations to recover their status.',
                    },
                  },
                ];
              }
            }
            if (
              (part.type === 'data-tool-call-approval' || part.type === 'data-tool-call-suspended') &&
              part.data &&
              typeof part.data === 'object' &&
              ids.has(String((part.data as Record<string, unknown>).toolCallId))
            )
              return [];
            return [part];
          });
          return ids.size ? [{ ...message, content: { ...message.content, parts, metadata } }] : [];
        });
        if (changed.length) await memory.saveMessages({ messages: changed });
      },
    };
    this.finalizations.set(threadId, finalization);
    void this.settled(threadId).catch(() => {});
  }
  alias(id: string, native: AnyAgent) {
    const canonical = this.decorated.get(native);
    if (!canonical) {
      if (!Object.values(this.integration.resources.agents).some(resource => resource.native === native))
        this.ordinaryAgents.add(id);
      return false;
    }
    this.ordinaryAgents.delete(id);
    const existing = this.aliases.get(id);
    if (existing && existing !== canonical) throw new BillingError('invalid_configuration');
    this.aliases.set(id, canonical);
    return true;
  }
  decorate<A extends AnyAgent>(agent: A): A {
    if (
      !(agent instanceof Agent) ||
      !identifierSchema.safeParse(agent.id).success ||
      Object.values(this.integration.resources.agents).some(resource => resource.native === agent) ||
      this.decorated.has(agent) ||
      this.agents[agent.id] ||
      this.integration.resources.agents[agent.id]
    )
      throw new BillingError('invalid_configuration');
    this.decorated.set(agent, agent.id);
    this.agents[agent.id] = agent;
    this.aliases.set(agent.id, agent.id);
    const runtime = this;
    // Own instance methods preserve the concrete SDK receiver, overloads and result objects.
    const methods = [
      'generate',
      'stream',
      'streamUntilIdle',
      'resumeStream',
      'resumeGenerate',
      'resumeStreamUntilIdle',
      'sendMessage',
      'sendSignal',
      'queueMessage',
      'queueSignal',
      'sendToolApproval',
      'approveToolCall',
      'declineToolCall',
      'approveToolCallGenerate',
      'declineToolCallGenerate',
      'subscribeToThread',
      'abortThreadStream',
      'abortRunStream',
    ] as const;
    for (const name of methods) {
      const original = agent[name] as (...args: any[]) => any;
      if (typeof original !== 'function') continue;
      Object.defineProperty(agent, name, {
        configurable: true,
        writable: true,
        value: function (...args: any[]) {
          const options = [
            'generate',
            'stream',
            'streamUntilIdle',
            'resumeStream',
            'resumeGenerate',
            'resumeStreamUntilIdle',
            'sendMessage',
            'sendSignal',
            'queueMessage',
            'queueSignal',
          ].includes(name)
            ? args[1]
            : args[0];
          const memory = options?.memory;
          const threadId =
            options?.threadId ?? (typeof memory?.thread === 'string' ? memory.thread : memory?.thread?.id);
          const conversation = runtime.request.getStore() ?? (threadId ? runtime.threads.get(threadId) : undefined);
          if (!conversation || conversation.owner.agentId !== agent.id) throw new BillingError('forbidden');
          if (threadId && threadId !== conversation.owner.threadId) throw new BillingError('forbidden');
          const invoke = () => original.apply(agent, args);
          if (name === 'abortThreadStream' || name === 'abortRunStream') {
            const runId =
              name === 'abortRunStream'
                ? args[0]
                : agent.getActiveThreadRunId({
                    threadId: conversation.owner.threadId,
                    resourceId: conversation.owner.resourceId,
                  });
            if (name === 'abortThreadStream' && options?.expectedRunId && options.expectedRunId !== runId) return false;
            conversation.controller.abort();
            const result = runtime.request.run(conversation, invoke);
            runtime.finalizeStopped(
              conversation,
              name === 'abortThreadStream' ? (options?.expectedRunId ?? runId) : runId,
            );
            return result;
          }
          conversation.controller.signal.throwIfAborted();
          if (
            [
              'stream',
              'generate',
              'streamUntilIdle',
              'resumeStream',
              'resumeGenerate',
              'resumeStreamUntilIdle',
            ].includes(name)
          ) {
            args[1] = {
              ...options,
              memory: { ...memory, thread: conversation.owner.threadId, resource: conversation.owner.resourceId },
              abortSignal: options?.abortSignal
                ? AbortSignal.any([options.abortSignal, conversation.controller.signal])
                : conversation.controller.signal,
            };
          }
          if (
            !runtime.approving.getStore() &&
            [
              'sendToolApproval',
              'approveToolCall',
              'declineToolCall',
              'approveToolCallGenerate',
              'declineToolCallGenerate',
            ].includes(name)
          ) {
            if (!options?.toolCallId || !runtime.approval) throw new BillingError('forbidden');
            const approved = name === 'sendToolApproval' ? options.approved : !name.startsWith('decline');
            return runtime.approval(conversation, options.toolCallId, approved).then(async approval => {
              if (name === 'sendToolApproval' && approval.replayed)
                return { accepted: true, runId: approval.runId, toolCallId: options.toolCallId };
              if (!approved && approval.declineReason)
                args[0] =
                  name === 'sendToolApproval'
                    ? {
                        ...options,
                        declineContext: { ...options.declineContext, reason: approval.declineReason },
                      }
                    : { ...options, reason: approval.declineReason };
              const result = await runtime.request.run(conversation, () => runtime.approving.run(true, invoke));
              await runtime.integration.conversations.acceptApproval(
                conversation.billing,
                conversation.owner,
                options.toolCallId,
              );
              return result;
            });
          }
          if (
            [
              'stream',
              'generate',
              'streamUntilIdle',
              'resumeStream',
              'resumeGenerate',
              'resumeStreamUntilIdle',
            ].includes(name)
          ) {
            return runtime.request.run(conversation, async () => {
              await runtime.integration.organizations.authorize(conversation.billing);
              if (args[1]?.runId)
                await runtime.integration.conversations.bindRun(
                  conversation.billing,
                  conversation.owner,
                  args[1].runId,
                );
              conversation.controller.signal.throwIfAborted();
              return invoke();
            });
          }
          const result = runtime.request.run(conversation, invoke);
          if (result?.accepted instanceof Promise) {
            void result.accepted
              .then(async (accepted: { runId?: string }) => {
                if (accepted.runId)
                  await runtime.integration.conversations.bindRun(
                    conversation.billing,
                    conversation.owner,
                    accepted.runId,
                  );
              })
              .catch(() => conversation.controller.abort());
          }
          return result;
        },
      });
    }
    return agent;
  }
}

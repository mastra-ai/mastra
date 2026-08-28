import { Agent, createSignal } from '@mastra/core/agent';
import type { SendAgentSignalAccepted, SendAgentSignalResult } from '@mastra/core/agent';
import type { InputProcessor, ProcessInputStepArgs, ProcessInputStepResult } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { KnowledgeScope, KnowledgeStorage, SearchKnowledgeResult } from '@mastra/core/storage';
import { canonicalizeKnowledgeScope } from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

import type { Memory } from '../../..';
import { Extractor } from '../extractor';
import type { ObservationalMemoryModel } from '../types';
import { publishSubconsciousActivity } from './activity';
import { createKnowledgeTools } from './knowledge-tools';
import { resolveReminderConversationModel } from './model';
import { ReminderResearchBudgetProcessor } from './remind-budget';
import type { RemindConversation, RemindRequestFailureStatus, RemindRequestRecord } from './remind-request-state';
import { REMINDER_TURN_DEADLINE_MS, RemindRequestRegistry } from './remind-request-state';
import { resolveKnowledgeResourceId } from './scope';
import type { ResolvedSubconsciousAgent } from './types';

const NO_REMINDER = '<no-reminder />';
const DEFAULT_INSTRUCTIONS = `Review the current observations and use the knowledge tools to find prior knowledge that is directly relevant now.

Be selective. Treat future-dated items as relevant when their time is imminent or useful to the current task. When the observations show whether an earlier reminder was used, tune your selectivity accordingly without storing hit/miss counters.
Never remind about knowledge that is already visible in the current observations or recent messages — a reminder is only valuable for knowledge the agent can no longer see. Echoing back what was just said or just captured is noise.
If nothing is relevant, respond with exactly ${NO_REMINDER} and nothing else.
If knowledge is relevant, return one concise reminder that explains why it matters and includes source node or item IDs. Do not invent knowledge and do not expose knowledge outside the tools' scoped results.`;

/** Own-thread records younger than this are treated as still-in-context and excluded from reminder candidates. */
const FRESH_OWN_RECORD_WINDOW_MS = 30 * 60 * 1000;

function resolveScope(context: {
  requestContext?: { get(key: string): unknown };
  resourceId?: string;
  threadId: string;
}) {
  const organizationId = context.requestContext?.get('organizationId');
  if (typeof organizationId !== 'string' || !organizationId.trim()) {
    throw new Error('Subconscious remind requires organizationId in the request context.');
  }
  const resourceId = resolveKnowledgeResourceId(context.requestContext, context.resourceId);
  if (!resourceId) {
    throw new Error('Subconscious remind requires a resourceId.');
  }

  return canonicalizeKnowledgeScope([`org:${organizationId}`, `resource:${resourceId}`, `thread:${context.threadId}`]);
}

const REMINDER_QUERY_STOP_WORDS = new Set([
  'about',
  'after',
  'before',
  'current',
  'from',
  'have',
  'observations',
  'that',
  'their',
  'there',
  'they',
  'this',
  'user',
  'what',
  'when',
  'where',
  'which',
  'with',
]);

async function findReminderSources(
  store: KnowledgeStorage,
  scope: KnowledgeScope,
  observations: string,
): Promise<SearchKnowledgeResult[]> {
  const terms = [
    ...new Set(
      observations
        .match(/[A-Za-z0-9][A-Za-z0-9_-]{3,}/g)
        ?.map(term => term.toLowerCase())
        .filter(term => !REMINDER_QUERY_STOP_WORDS.has(term)) ?? [],
    ),
  ].slice(0, 12);
  const results = (await Promise.all(terms.map(query => store.search({ query, scope, limit: 5 })))).flat();
  return [...new Map(results.map(result => [`${result.type}:${result.id}`, result])).values()].slice(0, 10);
}

/**
 * Drop the current thread's own freshly captured KnowledgeRecords from the candidate list. They match the
 * current observations almost perfectly (they were just distilled from them), so without this
 * guard the reminder agent mostly echoes the session's own words back at it.
 */
async function dropFreshOwnRecords(
  store: KnowledgeStorage,
  sources: SearchKnowledgeResult[],
  threadId: string,
): Promise<SearchKnowledgeResult[]> {
  const checks = await Promise.all(
    sources.map(async source => {
      if (source.type !== 'record') return true;
      const record = await store.getKnowledge({ id: source.id }).catch(() => null);
      if (!record) return true;
      // KnowledgeRecords written by the thread's own subconscious sub-agents (curate, learn, capture)
      // carry a `subconscious:<threadId>:<agent>` source — they are this thread's too.
      const isOwnThread =
        record.sourceThreadId === threadId || record.sourceThreadId.startsWith(`subconscious:${threadId}:`);
      const isFresh = Date.now() - new Date(record.capturedAt).getTime() < FRESH_OWN_RECORD_WINDOW_MS;
      return !(isOwnThread && isFresh);
    }),
  );
  return sources.filter((_, index) => checks[index]);
}

/**
 * Thread-metadata key stamping the parent session thread that owns a derived reminder thread. The
 * deletion cascade requires it, so an unrelated thread that happens to occupy the derived id under
 * the same resource is never deleted.
 */
export const REMIND_PARENT_THREAD_METADATA_KEY = 'subconsciousRemindParentThreadId';

/**
 * The id of the reminder agent's own conversation thread, derived from the parent session's thread
 * id. The derived thread is owned by the session: it is created on demand when the session first
 * reminds, and `Memory.deleteThread()` cascades to it when the session's thread is deleted.
 */
export function remindThreadKey(parentThreadId: string): string {
  return `subconscious:${parentThreadId}:remind`;
}

/**
 * The resource id the reminder conversation runs under. The runtime serializes work by
 * `[resourceId, threadId]`, so EVERY entry point must derive the resource identically — asks and
 * passive evaluations resolving different resource ids for the same session would split one
 * memory thread into two execution streams. Both paths resolve the optional knowledge-resource
 * override first, then fall back to the parent thread id when the session has no resource.
 */
function reminderResourceId(parentThreadId: string, resourceId?: string): string {
  return resourceId ?? parentThreadId;
}

/**
 * Stamps the derived reminder thread with the parent thread that owns it.
 *
 * The reminder conversation is created by the thread-stream runtime through `sendMessage()`, which
 * carries no thread-metadata channel, so provenance has to be written here before the first turn.
 * Without it `Memory.deleteThread()` cannot prove the derived thread belongs to the session being
 * deleted, and conservatively retains it forever.
 *
 * Returns false when an observed thread does not match both the expected resource and parent
 * provenance, so the caller can continue without persistent reminder memory. The storage API has
 * no conditional-create operation, so a cross-process writer can still race the initial save; the
 * post-write read only catches a writer that supersedes this process.
 */
async function ensureRemindThreadProvenance(args: {
  memory: Memory;
  remindThreadId: string;
  resourceId: string;
  parentThreadId: string;
}): Promise<boolean> {
  const existing = await args.memory.getThreadById({ threadId: args.remindThreadId });
  if (existing) {
    return (
      existing.resourceId === args.resourceId &&
      existing.metadata?.[REMIND_PARENT_THREAD_METADATA_KEY] === args.parentThreadId
    );
  }

  await args.memory.saveThread({
    thread: {
      id: args.remindThreadId,
      resourceId: args.resourceId,
      createdAt: new Date(),
      updatedAt: new Date(),
      title: 'Subconscious Remind',
      metadata: { [REMIND_PARENT_THREAD_METADATA_KEY]: args.parentThreadId },
    },
  });

  const persisted = await args.memory.getThreadById({ threadId: args.remindThreadId });
  return (
    persisted?.resourceId === args.resourceId &&
    persisted.metadata?.[REMIND_PARENT_THREAD_METADATA_KEY] === args.parentThreadId
  );
}

export interface SubconsciousRemindOptions {
  /**
   * Returns the Memory that backs the reminder agent's own conversation. Called on demand so a
   * session that never reminds never builds one, and called again for every reminder turn rather
   * than cached: a cached instance would pin the model of whichever session reminded first. Persisted
   * continuity is unaffected, because the observational record and its locks are keyed by the thread,
   * not by the instance; only in-process caches are rebuilt with it.
   */
  createRemindMemory?: () => Memory;
  /**
   * Correlated lifecycle registry shared by every reminder agent this Memory creates. It records
   * routing, status, deadlines, and terminal deduplication while answers travel directly through
   * source-agent signals.
   */
  registry?: RemindRequestRegistry;
}

const ASK_INSTRUCTIONS = `The main agent is asking you direct questions. This is a conversation, not an observation run: answer the question.

Every question arrives with a correlationId. Answer it by calling reply_to_memory_question with that exact correlationId — plain text in the response is not delivered to the asker. Send delta-only partial answers with more_coming true while research continues, then one terminal delta with more_coming false. Several questions may arrive during one turn; keep each correlation's answer sequence independent.

Use everything you already remember from this conversation plus the knowledge tools. A follow-up may refer back to something discussed earlier in this thread, so resolve references against your own history before searching. Answer plainly and include source node or item IDs when the answer rests on stored knowledge. If you do not know, say so plainly instead of guessing, and never respond with ${NO_REMINDER} to a question.`;

type AskToolAgentContext = {
  agentId?: string;
  threadId?: string;
  resourceId?: string;
};

type AskToolContext = {
  agent?: AskToolAgentContext;
  requestContext?: RequestContext;
  abortSignal?: AbortSignal;
  writer?: { custom(chunk: { type: string; data: unknown }): Promise<unknown> | unknown };
  mastra?: { getAgentById?(id: string): Promise<unknown> | unknown };
};

const NO_MODEL_MESSAGE =
  'The reminder agent has no model available at tool call time. Configure a model on the Subconscious remind agent or on observational memory; the main agent model is only reachable from the observation hook.';

type SignalSender = {
  sendSignal(
    signal: unknown,
    target: {
      threadId: string;
      resourceId: string;
      ifIdle?: { behavior?: 'wake' | 'persist'; streamOptions?: { requestContext?: RequestContext } };
    },
  ): SendAgentSignalResult;
};

type ReplyCapability = {
  sourceAgent: SignalSender;
  conversation: RemindConversation;
  expiryTimer: ReturnType<typeof setTimeout>;
};

type ReplyCapabilityRegistry = Map<string, ReplyCapability>;

const replyCapabilitiesByRegistry = new WeakMap<RemindRequestRegistry, ReplyCapabilityRegistry>();

function resolveReplyCapabilities(registry: RemindRequestRegistry): ReplyCapabilityRegistry {
  let capabilities = replyCapabilitiesByRegistry.get(registry);
  if (!capabilities) {
    capabilities = new Map();
    replyCapabilitiesByRegistry.set(registry, capabilities);
  }
  return capabilities;
}

function deleteReplyCapability(capabilities: ReplyCapabilityRegistry, correlationId: string) {
  const capability = capabilities.get(correlationId);
  if (capability) clearTimeout(capability.expiryTimer);
  capabilities.delete(correlationId);
}

async function acceptSignalDelivery(
  result: SendAgentSignalResult,
  deadlineAt: number,
): Promise<SendAgentSignalAccepted> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const remainingMs = Math.max(0, deadlineAt - Date.now());
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Answer delivery exceeded the question deadline.')), remainingMs);
    timer.unref?.();
  });

  try {
    return await Promise.race([result.accepted, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface RemindAskToolOptions extends SubconsciousRemindOptions {
  memory: Memory;
  config: ResolvedSubconsciousAgent;
  omModel?: ObservationalMemoryModel;
}

async function resolveSignalSender(context: AskToolContext): Promise<SignalSender | undefined> {
  const agentId = context.agent?.agentId;
  const getAgentById = context.mastra?.getAgentById;
  if (!agentId || typeof getAgentById !== 'function') return undefined;
  const agent = (await getAgentById.call(context.mastra, agentId)) as Partial<SignalSender> | undefined;
  return typeof agent?.sendSignal === 'function' ? (agent as SignalSender) : undefined;
}

function createReplyTool(
  registry: RemindRequestRegistry,
  capabilities: ReplyCapabilityRegistry,
  conversation: RemindConversation,
  allowedCorrelationIds: ReadonlySet<string>,
) {
  return createTool({
    id: 'reply_to_memory_question',
    description:
      'Deliver an answer delta to a question the main agent asked. Set more_coming true while research continues and false for the terminal delta.',
    inputSchema: {
      type: 'object',
      properties: {
        correlationId: { type: 'string', minLength: 1, description: 'The correlationId that came with the question.' },
        answer: { type: 'string', minLength: 1, description: 'The next answer delta, in natural language.' },
        more_coming: {
          type: 'boolean',
          description: 'True when another answer delta will follow; false when this delta closes the question.',
        },
      },
      required: ['correlationId', 'answer', 'more_coming'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, rawContext) => {
      const { correlationId, answer, more_coming } = input as {
        correlationId: string;
        answer: string;
        more_coming: boolean;
      };
      const context = rawContext as AskToolContext;
      if (!allowedCorrelationIds.has(correlationId)) {
        return {
          ok: false,
          correlationId,
          error: `Question ${correlationId} is not part of the current reminder input.`,
        };
      }
      if (
        context.agent?.threadId !== conversation.remindThreadId ||
        context.agent?.resourceId !== conversation.resourceId
      ) {
        return { ok: false, correlationId, error: `Question ${correlationId} belongs to another conversation.` };
      }

      const action = more_coming ? 'deliver_partial' : 'deliver_terminal';
      const reservation = more_coming
        ? registry.reservePartial(correlationId, conversation)
        : registry.reserveTerminal(correlationId, conversation);
      if ('outcome' in reservation && reservation.outcome === 'duplicate') {
        return {
          ok: true,
          correlationId,
          delivered: reservation.record.status === 'replied',
          duplicate: true,
          status: reservation.record.status,
        };
      }
      if (reservation.outcome === 'rejected') {
        return {
          ok: false,
          correlationId,
          error:
            reservation.reason === 'unknown'
              ? `No open question with correlationId ${correlationId}. It may have timed out already.`
              : reservation.reason === 'wrong_conversation'
                ? `Question ${correlationId} belongs to another conversation.`
                : reservation.reason === 'in_progress'
                  ? `Question ${correlationId} already has an answer delivery in progress.`
                  : `Question ${correlationId} can no longer accept an answer.`,
        };
      }

      registry.recordActivity(correlationId, { toolName: 'reply_to_memory_question', action, status: 'started' });
      const capability = capabilities.get(correlationId);
      if (!capability) {
        registry.recordActivity(correlationId, { toolName: 'reply_to_memory_question', action, status: 'failed' });
        if (more_coming) {
          registry.releasePartial(correlationId);
        } else {
          registry.fail(
            correlationId,
            'delivery_unknown',
            'The source delivery capability expired before terminal reply.',
          );
        }
        return {
          ok: false,
          correlationId,
          error: `Question ${correlationId} no longer has a source delivery capability.`,
        };
      }

      const sequence = more_coming ? reservation.record.partialSequence + 1 : reservation.record.terminalSequence!;
      const signalId = more_coming ? reservation.record.partialSignalId! : reservation.record.terminalSignalId!;
      const signal = createSignal({
        id: signalId,
        type: 'reactive',
        tagName: 'remembered',
        contents: answer,
        createdAt: new Date(),
        transient: false,
        metadata: { origin: 'subconscious' },
        attributes: {
          source: 'subconscious',
          agent: 'remind',
          correlationId,
          sequence,
          more_coming,
          status: more_coming ? 'partial' : 'replied',
          sourceAgentId: reservation.record.sourceAgentId,
          sourceThreadId: reservation.record.sourceThreadId,
          sourceResourceId: reservation.record.sourceResourceId,
          remindThreadId: conversation.remindThreadId,
          remindResourceId: conversation.resourceId,
        },
      });

      let accepted: SendAgentSignalAccepted;
      try {
        accepted = await acceptSignalDelivery(
          capability.sourceAgent.sendSignal(signal, {
            threadId: reservation.record.sourceThreadId,
            resourceId: reservation.record.sourceResourceId,
            ifIdle: more_coming
              ? { behavior: 'persist' }
              : { behavior: 'wake', streamOptions: { requestContext: context.requestContext } },
          }),
          reservation.record.deadlineAt,
        );
      } catch (error) {
        registry.recordActivity(correlationId, { toolName: 'reply_to_memory_question', action, status: 'failed' });
        if (more_coming) {
          registry.releasePartial(correlationId);
        } else {
          registry.fail(correlationId, 'delivery_unknown', error instanceof Error ? error.message : String(error));
          deleteReplyCapability(capabilities, correlationId);
        }
        return { ok: false, correlationId, error: 'Answer delivery could not be confirmed.' };
      }

      if (accepted.action === 'blocked' || accepted.action === 'discard') {
        const refusal = accepted.action === 'blocked' ? accepted.reason : accepted.action;
        registry.recordActivity(correlationId, { toolName: 'reply_to_memory_question', action, status: 'failed' });
        if (more_coming) {
          registry.releasePartial(correlationId);
        } else {
          registry.fail(correlationId, 'delivery_failed', refusal);
          deleteReplyCapability(capabilities, correlationId);
        }
        return {
          ok: false,
          correlationId,
          error: `The source conversation refused the answer: ${refusal}.`,
        };
      }

      registry.recordActivity(correlationId, { toolName: 'reply_to_memory_question', action, status: 'completed' });
      if (more_coming) {
        registry.markPartialDelivered(correlationId, sequence);
      } else {
        registry.markReplied(correlationId);
        deleteReplyCapability(capabilities, correlationId);
      }
      return { ok: true, correlationId, delivered: true, sequence, more_coming };
    },
  });
}

export function createReplyToolProcessor(
  registry: RemindRequestRegistry,
  conversation: RemindConversation,
  capabilities: ReplyCapabilityRegistry = resolveReplyCapabilities(registry),
): InputProcessor {
  return {
    id: 'remind-current-question-tools',
    processInputStep(args: ProcessInputStepArgs): ProcessInputStepResult | undefined {
      const correlations = new Set<string>();
      for (const message of args.messages as Array<{
        metadata?: Record<string, unknown>;
        content?: string | { parts?: Array<{ type?: string; text?: string }> };
      }>) {
        const metadata = message.metadata;
        const content = message.content;
        const text =
          typeof content === 'string'
            ? content
            : (content?.parts ?? [])
                .filter(part => part.type === 'text')
                .map(part => part.text ?? '')
                .join('\n');
        const correlationId =
          metadata?.kind === 'remind-ask' && typeof metadata.correlationId === 'string'
            ? metadata.correlationId
            : /Question \[correlationId: (remind-ask-[0-9a-f-]+)\]:/.exec(text)?.[1];
        if (!correlationId) continue;
        const record = registry.get(correlationId);
        const candidate = capabilities.get(correlationId);
        if (!record || record.status !== 'pending' || !candidate) continue;
        if (
          candidate.conversation.remindThreadId !== conversation.remindThreadId ||
          candidate.conversation.resourceId !== conversation.resourceId
        ) {
          continue;
        }
        correlations.add(correlationId);
      }
      if (correlations.size === 0) return undefined;
      return {
        tools: {
          ...args.tools,
          reply_to_memory_question: createReplyTool(registry, capabilities, conversation, correlations),
        },
      };
    },
  };
}

function withReminderActivity(
  tools: Record<string, ToolAction<any, any, any>>,
  registry: RemindRequestRegistry,
  conversation: RemindConversation,
): Record<string, ToolAction<any, any, any>> {
  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => {
      const execute = tool.execute;
      if (!execute) return [name, tool];
      return [
        name,
        {
          ...tool,
          execute: async (...args: Parameters<NonNullable<typeof execute>>) => {
            const correlationIds = registry.openCorrelationIds(conversation);
            for (const correlationId of correlationIds) {
              registry.recordActivity(correlationId, { toolName: name, action: 'execute', status: 'started' });
            }
            try {
              const result = await execute.call(tool, ...args);
              for (const correlationId of correlationIds) {
                registry.recordActivity(correlationId, { toolName: name, action: 'execute', status: 'completed' });
              }
              return result;
            } catch (error) {
              for (const correlationId of correlationIds) {
                registry.recordActivity(correlationId, { toolName: name, action: 'execute', status: 'failed' });
              }
              throw error;
            }
          },
        },
      ];
    }),
  );
}

function createReminderAgent(args: {
  parentThreadId: string;
  conversation: RemindConversation;
  instructions: string;
  model: NonNullable<Awaited<ReturnType<typeof resolveReminderConversationModel>>>;
  memory: Memory;
  scope: KnowledgeScope;
  registry: RemindRequestRegistry;
  replyCapabilities: ReplyCapabilityRegistry;
  remindMemory?: Memory;
}): Agent {
  return new Agent({
    id: `subconscious-remind-${args.parentThreadId}`,
    name: 'Subconscious Remind',
    instructions: args.instructions,
    model: args.model,
    ...(args.remindMemory ? { memory: args.remindMemory } : {}),
    tools: withReminderActivity(createKnowledgeTools(args.memory, args.scope), args.registry, args.conversation),
    inputProcessors: [
      createReplyToolProcessor(args.registry, args.conversation, args.replyCapabilities),
      new ReminderResearchBudgetProcessor(args.registry, args.conversation),
    ],
  });
}

interface ReminderConversationTurnArgs {
  agent: Agent;
  /** The parent session thread id; the reminder thread key is derived from it. */
  parentThreadId: string;
  resourceId: string;
  prompt: string;
  requestContext?: RequestContext;
  maxSteps?: number;
  deadlineMs?: number;
  /**
   * Rejects this passive evaluation when aborted. The reminder turn itself is not cancelled, so its
   * transcript can still persist in causal order.
   */
  abortSignal?: AbortSignal;
}

/**
 * Run one serialized passive-evaluation turn in the continuing reminder conversation.
 *
 * Explicit questions bypass this helper: they are acknowledged after `sendMessage()` accepts them,
 * and correlated answers return directly through source-agent signals. Passive evaluation needs the
 * accepted wake run's final text, so it consumes that run's stream without attributing question
 * answers to run completion.
 *
 * Both paths use the same resource and reminder thread. The core thread-stream runtime owns active,
 * reserved, and idle routing, serializes turns, and persists conversation history in causal order.
 */
async function runReminderConversationTurn(args: ReminderConversationTurnArgs): Promise<string> {
  const threadId = remindThreadKey(args.parentThreadId);
  const deadlineMs = args.deadlineMs ?? REMINDER_TURN_DEADLINE_MS;
  if (args.abortSignal?.aborted) {
    throw new Error('The caller aborted while waiting for the reminder conversation turn.');
  }

  const result = args.agent.sendMessage(args.prompt, {
    threadId,
    resourceId: args.resourceId,
    ifIdle: {
      behavior: 'wake',
      streamOptions: {
        requestContext: args.requestContext,
        maxSteps: args.maxSteps,
      },
    },
  });
  const accepted = await Promise.race([
    result.accepted,
    new Promise<never>((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`The reminder conversation did not accept this turn within ${deadlineMs}ms.`)),
        deadlineMs,
      );
      (timer as { unref?: () => void }).unref?.();
    }),
  ]);

  if (accepted.action === 'blocked' || accepted.action === 'discard') {
    throw new Error(
      accepted.action === 'blocked'
        ? `The reminder conversation is blocked: ${accepted.reason}.`
        : 'The reminder conversation discarded this turn.',
    );
  }
  if (accepted.action !== 'wake') return NO_REMINDER;

  if (args.abortSignal?.aborted) {
    throw new Error('The caller aborted while waiting for the reminder conversation turn.');
  }
  await accepted.output.consumeStream();
  return (await accepted.output.getFullOutput()).text.trim();
}

/**
 * The reminder agent as an agent-facing tool. The main agent receives an immediate routing
 * acknowledgement; the answer returns later as a correlated source-agent signal. Questions and
 * passive evaluations enter the same serialized reminder conversation.
 */
export function createRemindWaitTool(registry: RemindRequestRegistry) {
  return createTool({
    id: 'wait_for_memory_answers',
    description:
      'Wait briefly for one or more accepted memory questions to reach a terminal lifecycle state. Returns status and sanitized recent activity only; answers still arrive through reactive remembered signals.',
    inputSchema: {
      type: 'object',
      properties: {
        correlationIds: {
          type: 'array',
          minItems: 1,
          uniqueItems: true,
          items: { type: 'string', minLength: 1 },
          description: 'Correlation IDs returned by ask_memory.',
        },
        timeoutMs: {
          type: 'integer',
          minimum: 0,
          maximum: 15_000,
          description: 'Maximum checkpoint wait in milliseconds. Defaults to 15000.',
        },
      },
      required: ['correlationIds'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, rawContext) => {
      const { correlationIds, timeoutMs = 15_000 } = input as { correlationIds: string[]; timeoutMs?: number };
      const boundedTimeoutMs = Math.min(15_000, Math.max(0, timeoutMs));
      const context = rawContext as AskToolContext;
      const source =
        context.agent?.agentId && context.agent.threadId && context.agent.resourceId
          ? {
              agentId: context.agent.agentId,
              threadId: context.agent.threadId,
              resourceId: context.agent.resourceId,
            }
          : undefined;
      if (!source) return { ok: false, error: 'wait_for_memory_answers requires an active source Agent.' };

      const startedAt = Date.now();
      let checkpoint = registry.checkpoint(correlationIds, false, source);
      while (checkpoint.outstanding && Date.now() - startedAt < boundedTimeoutMs && !context.abortSignal?.aborted) {
        await new Promise<void>(resolve => {
          setTimeout(resolve, Math.min(25, boundedTimeoutMs - (Date.now() - startedAt)));
        });
        checkpoint = registry.checkpoint(correlationIds, false, source);
      }

      const timedOut = checkpoint.outstanding && !context.abortSignal?.aborted;
      if (timedOut) checkpoint = registry.checkpoint(correlationIds, true, source);
      return {
        ok: true,
        scope: 'current_process',
        aborted: context.abortSignal?.aborted || undefined,
        ...checkpoint,
        note: checkpoint.outstanding
          ? 'Some memory research is still outstanding. Continue now or call this checkpoint again later; reactive answers may still arrive.'
          : 'Every requested memory question reached a terminal lifecycle state.',
      };
    },
  });
}

export function createRemindAskTool(options: RemindAskToolOptions) {
  const { memory, config, omModel } = options;
  // Same fallback the passive path uses. A per-call registry here would put the ask tool and the
  // reminder agent that answers it on two different authorities whenever an owner wired none.
  const registry = options.registry ?? fallbackRegistry();
  const replyCapabilities = resolveReplyCapabilities(registry);

  /** The single acceptance-only dispatch path for every explicit reminder question. */
  const dispatch = async (
    question: string,
    context: AskToolContext,
    threadId: string,
    sourceAgent: SignalSender,
  ): Promise<RemindRequestRecord> => {
    const sourceResourceId = context.agent?.resourceId;
    const sourceAgentId = context.agent?.agentId;
    if (!sourceResourceId || !sourceAgentId) {
      throw new ReminderUnavailableError('ask_memory requires an active source Agent, thread, and resource.');
    }

    const scope = resolveScope({ requestContext: context.requestContext, resourceId: sourceResourceId, threadId });
    const instructions = [DEFAULT_INSTRUCTIONS, ASK_INSTRUCTIONS, config.instructions?.trim()]
      .filter(Boolean)
      .join('\n\n');
    const model = await resolveReminderConversationModel({ config, omModel, requestContext: context.requestContext });
    if (!model) throw new ReminderUnavailableError(NO_MODEL_MESSAGE);

    const conversation: RemindConversation = {
      remindThreadId: remindThreadKey(threadId),
      resourceId: reminderResourceId(threadId, resolveKnowledgeResourceId(context.requestContext, sourceResourceId)),
    };
    const correlationId = `remind-ask-${crypto.randomUUID()}`;
    const record = registry.create({
      correlationId,
      conversation,
      sourceAgentId,
      sourceThreadId: threadId,
      sourceResourceId,
    });
    const expiryTimer = setTimeout(
      () => deleteReplyCapability(replyCapabilities, correlationId),
      Math.max(0, record.deadlineAt - Date.now()),
    );
    expiryTimer.unref?.();
    replyCapabilities.set(correlationId, { sourceAgent, conversation, expiryTimer });

    const fail = (status: RemindRequestFailureStatus, error: unknown) => {
      registry.fail(correlationId, status, error instanceof Error ? error.message : String(error));
      deleteReplyCapability(replyCapabilities, correlationId);
    };

    try {
      if (context.abortSignal?.aborted) {
        throw new Error('The caller aborted before submitting the reminder question.');
      }
      let remindMemory = options.createRemindMemory?.();
      if (
        remindMemory &&
        !(await ensureRemindThreadProvenance({
          memory: remindMemory,
          remindThreadId: conversation.remindThreadId,
          resourceId: conversation.resourceId,
          parentThreadId: threadId,
        }))
      ) {
        remindMemory = undefined;
      }
      const agent = createReminderAgent({
        parentThreadId: threadId,
        conversation,
        instructions,
        model,
        memory,
        scope,
        registry,
        replyCapabilities,
        remindMemory,
      });
      const contents = `Current time: ${new Date().toISOString()}\n\nQuestion [correlationId: ${correlationId}]: ${question}\n\nAnswer this by calling reply_to_memory_question with correlationId "${correlationId}".`;
      const result = agent.sendMessage(
        {
          contents,
          metadata: {
            correlationId,
            kind: 'remind-ask',
            sourceAgentId,
            sourceThreadId: threadId,
            sourceResourceId,
            parentThreadId: threadId,
            remindThreadId: conversation.remindThreadId,
          },
        },
        {
          threadId: conversation.remindThreadId,
          resourceId: conversation.resourceId,
          ifIdle: {
            behavior: 'wake',
            streamOptions: {
              requestContext: context.requestContext,
              maxSteps: config.maxSteps,
              onError: ({ error }: { error: Error | string }) => fail('model_failed', error),
            },
          },
        },
      );
      const disposition = await result.accepted;
      if (disposition.action === 'blocked' || disposition.action === 'discard') {
        fail('delivery_failed', disposition.action === 'blocked' ? disposition.reason : disposition.action);
      } else if (disposition.action === 'wake') {
        void disposition.output.consumeStream().catch(error => fail('model_failed', error));
      }
    } catch (error) {
      fail(context.abortSignal?.aborted ? 'aborted' : 'delivery_failed', error);
    }

    return record;
  };

  const askMemory = createTool({
    id: 'ask_memory',
    description:
      'Ask the reminder agent a question about what this session already knows or discussed. The question is accepted immediately; its terminal answer arrives later as a correlated reactive remembered signal.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', minLength: 1, description: 'The question, in natural language.' },
      },
      required: ['question'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, rawContext) => {
      const { question } = input as { question: string };
      const context = rawContext as AskToolContext;
      const threadId = context.agent?.threadId;
      if (!threadId) return { ok: false, error: 'ask_memory requires an active threadId.' };

      let sourceAgent: SignalSender | undefined;
      try {
        sourceAgent = await resolveSignalSender(context);
      } catch (error) {
        return { ok: false, ...describeAskFailure(error) };
      }
      if (!sourceAgent || !context.agent?.resourceId) {
        return { ok: false, error: 'ask_memory requires the source Agent signal channel.' };
      }

      let record: RemindRequestRecord;
      try {
        record = await dispatch(question, context, threadId, sourceAgent);
      } catch (error) {
        return { ok: false, ...describeAskFailure(error) };
      }
      if (record.failure) {
        return {
          ok: false,
          correlationId: record.correlationId,
          status: record.status,
          error: record.failure.message,
        };
      }

      return {
        ok: true,
        accepted: true,
        correlationId: record.correlationId,
        status: 'pending',
        note: 'The answer will arrive as a correlated reactive remembered signal. Use wait_for_memory_answers only for a bounded status and activity checkpoint.',
      };
    },
  });

  return {
    ask_memory: askMemory,
    wait_for_memory_answers: createRemindWaitTool(registry),
  } satisfies Record<string, ToolAction<any, any, any, any, any, any, any>>;
}

/**
 * Registry used when the owner wired none. The current-input processor injects the reply tool only
 * when a correlated question in this registry belongs to the active reminder conversation.
 */
let fallback: RemindRequestRegistry | undefined;
function fallbackRegistry(): RemindRequestRegistry {
  return (fallback ??= new RemindRequestRegistry());
}

/** A configuration gap rather than a failure — reported as an explicit unavailable result. */
class ReminderUnavailableError extends Error {}

function describeAskFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return error instanceof ReminderUnavailableError ? { unavailable: true, error: message } : { error: message };
}

export class SubconsciousRemindExtractor extends Extractor<string> {
  constructor(
    config: ResolvedSubconsciousAgent,
    omModel?: ObservationalMemoryModel,
    options?: SubconsciousRemindOptions,
  ) {
    super({
      name: 'Remind',
      mode: 'hook',
      metadataKeyPath: false,
      onExtracted: async context => {
        if (!context.rawObservations?.trim() || !context.memory || !context.sendSignal) {
          return;
        }

        let scope: KnowledgeScope | undefined;
        let store: KnowledgeStorage | undefined;
        try {
          scope = resolveScope(context);
          store = await context.memory.storage.getStore('knowledge');
          if (!store) throw new Error('Subconscious remind requires a configured knowledge storage domain.');
          const sources = await dropFreshOwnRecords(
            store,
            await findReminderSources(store, scope, context.rawObservations),
            context.threadId,
          );
          if (sources.length === 0) return;
          const instructions = [DEFAULT_INSTRUCTIONS, config.instructions?.trim()].filter(Boolean).join('\n\n');
          const recentMessagesSection = context.recentMessages?.trim()
            ? `\n\nRecent conversation messages (already visible to the agent — never remind about anything present here):\n${context.recentMessages}`
            : '';
          const prompt = `Current time: ${new Date().toISOString()}\n\nScoped source candidates:\n${JSON.stringify(sources)}\n\nCurrent observations:\n${context.rawObservations}${recentMessagesSection}`;
          const model = await resolveReminderConversationModel({
            config,
            omModel,
            mainAgent: context.mainAgent,
            requestContext: context.requestContext,
          });
          if (!model) return;
          // One reminder conversation per main-agent session. The thread key is derived from the
          // PARENT thread id, not from the agent id above, and matches the curate/learn convention.
          // The evaluation enters the same serialized conversation as asks, so a passive reminder
          // never interleaves with an in-flight question turn. Without the session's resource owner,
          // run stateless rather than persist an orphaned derived thread that deleteThread cannot own.
          const registry = options?.registry ?? fallbackRegistry();
          const conversationResourceId = reminderResourceId(
            context.threadId,
            resolveKnowledgeResourceId(context.requestContext, context.resourceId),
          );
          let remindMemory = context.resourceId ? options?.createRemindMemory?.() : undefined;
          if (
            remindMemory &&
            !(await ensureRemindThreadProvenance({
              memory: remindMemory,
              remindThreadId: remindThreadKey(context.threadId),
              resourceId: conversationResourceId,
              parentThreadId: context.threadId,
            }))
          ) {
            remindMemory = undefined;
          }
          const agent = createReminderAgent({
            parentThreadId: context.threadId,
            conversation: {
              remindThreadId: remindThreadKey(context.threadId),
              resourceId: conversationResourceId,
            },
            instructions,
            model,
            memory: context.memory,
            scope,
            // A question can be delivered into this passive run, so it must carry the same reply
            // authority an ask-woken run has.
            registry,
            replyCapabilities: resolveReplyCapabilities(registry),
            remindMemory,
          });
          const reminder = await runReminderConversationTurn({
            agent,
            parentThreadId: context.threadId,
            resourceId: conversationResourceId,
            prompt,
            requestContext: context.requestContext,
            maxSteps: config.maxSteps,
            // The passive evaluation stops waiting when its calling turn aborts. The reminder turn
            // itself may still complete and persist in causal order.
            abortSignal: context.abortSignal,
          });
          if (!reminder || /^<no-reminder\s*\/>$/i.test(reminder)) {
            return;
          }

          const candidateIds = [...new Set(sources.flatMap(source => [source.id, source.recordId]))];
          const sourceIds = candidateIds.filter(id => reminder.includes(id)).slice(0, 5);
          if (sourceIds.length === 0) {
            return;
          }
          const contents = `${reminder}\n\nSources: ${sourceIds.join(', ')}`;
          await context.sendSignal({
            id: `__subconscious_remembered_${crypto.randomUUID()}`,
            type: 'reactive',
            tagName: 'remembered',
            contents,
            createdAt: new Date(),
            metadata: { origin: 'subconscious' },
            attributes: {
              source: 'subconscious',
              sourceIds: sourceIds.join(','),
              agent: 'remind',
              threadId: context.threadId,
            },
          });
        } catch (error) {
          await context.writer?.custom({
            type: 'data-subconscious-error',
            data: { agent: 'remind', error: error instanceof Error ? error.message : String(error) },
          });
          if (store && scope) {
            await publishSubconsciousActivity({
              store,
              scope,
              recentUpdates: 10,
              sendStateSignal: context.sendStateSignal,
              errors: [`remind: ${error instanceof Error ? error.message : String(error)}`],
            });
          }
          throw error;
        }
      },
    });
  }
}

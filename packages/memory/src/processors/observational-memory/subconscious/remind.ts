import { Agent, createSignal } from '@mastra/core/agent';
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
import { resolveReminderLaneModel } from './model';
import { resolveKnowledgeResourceId } from './scope';
import type { ResolvedSubconsciousAgent } from './types';

const NO_REMINDER = '<no-reminder />';
const DEFAULT_INSTRUCTIONS = `Review the current observations and use the knowledge tools to find prior knowledge that is directly relevant now.

Be selective. Treat future-dated items as relevant when their time is imminent or useful to the current task. When the observations show whether an earlier reminder was used, tune your selectivity accordingly without storing hit/miss counters.
Never remind about knowledge that is already visible in the current observations or recent messages — a reminder is only valuable for knowledge the agent can no longer see. Echoing back what was just said or just captured is noise.
If nothing is relevant, respond with exactly ${NO_REMINDER} and nothing else.
If knowledge is relevant, return one concise reminder that explains why it matters and includes source node or item IDs. Do not invent knowledge and do not expose knowledge outside the tools' scoped results.`;

/** Own-thread items younger than this are treated as still-in-context and excluded from reminder candidates. */
const FRESH_OWN_ITEM_WINDOW_MS = 30 * 60 * 1000;

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
 * Drop the current thread's own freshly captured KnowledgeItems from the candidate list. They match the
 * current observations almost perfectly (they were just distilled from them), so without this
 * guard the reminder agent mostly echoes the session's own words back at it.
 */
async function dropFreshOwnItems(
  store: KnowledgeStorage,
  sources: SearchKnowledgeResult[],
  threadId: string,
): Promise<SearchKnowledgeResult[]> {
  const checks = await Promise.all(
    sources.map(async source => {
      if (source.type !== 'item') return true;
      const item = await store.getItem({ id: source.id }).catch(() => null);
      if (!item) return true;
      // KnowledgeItems written by the thread's own subconscious sub-agents (curate, learn, capture)
      // carry a `subconscious:<threadId>:<agent>` source — they are this thread's too.
      const isOwnThread =
        item.sourceThreadId === threadId || item.sourceThreadId.startsWith(`subconscious:${threadId}:`);
      const isFresh = Date.now() - new Date(item.capturedAt).getTime() < FRESH_OWN_ITEM_WINDOW_MS;
      return !(isOwnThread && isFresh);
    }),
  );
  return sources.filter((_, index) => checks[index]);
}

/**
 * The id of the reminder agent's own conversation thread, derived from the parent session's thread
 * id. The derived thread is owned by the session: it is created on demand when the session first
 * reminds, and `Memory.deleteThread()` cascades to it when the session's thread is deleted.
 */
export function remindThreadKey(parentThreadId: string): string {
  return `subconscious:${parentThreadId}:remind`;
}

/**
 * The resource id the lane runs under. The runtime keys its serialization lane on
 * `[resourceId, threadId]`, so EVERY entry point must derive the resource identically — asks and
 * passive evaluations resolving different resource ids for the same session would split into two
 * lanes on the same memory thread and interleave. Both paths read the session's resource and fall
 * back to the parent thread id when the session has none.
 */
function laneResourceId(parentThreadId: string, resourceId?: string): string {
  return resourceId ?? parentThreadId;
}

export interface SubconsciousRemindOptions {
  /**
   * Returns the Memory that backs the reminder agent's own conversation. Called on demand so a
   * session that never reminds never builds one; the owner caches the instance, and per-session
   * identity is carried by the thread key alone, not by the instance.
   */
  createRemindMemory?: () => Memory;
}

const ASK_INSTRUCTIONS = `The main agent is asking you a direct question. This is a conversation, not an observation run: answer the question.

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
  sendSignal(signal: unknown, target: { threadId: string; resourceId: string }): { persisted?: Promise<void> };
};

export interface RemindAskToolOptions extends SubconsciousRemindOptions {
  memory: Memory;
  config: ResolvedSubconsciousAgent;
  omModel?: ObservationalMemoryModel;
}

/**
 * Resolve a signal sender for the late (`wait: false`) answer. The tool execute context carries no
 * `sendSignal` of its own — the only route is the main agent instance, reached exactly the way
 * `packages/core/src/notifications/tool.ts:53-63` reaches it.
 */
async function resolveSignalSender(context: AskToolContext): Promise<SignalSender | undefined> {
  const agentId = context.agent?.agentId;
  const getAgentById = context.mastra?.getAgentById;
  if (!agentId || typeof getAgentById !== 'function') return undefined;
  const agent = (await getAgentById.call(context.mastra, agentId)) as Partial<SignalSender> | undefined;
  return typeof agent?.sendSignal === 'function' ? (agent as SignalSender) : undefined;
}

/**
 * How long a lane turn may take before the waiter gives up. The turn itself is NOT cancelled —
 * the lane run continues and its transcript still persists in order; only the caller stops
 * waiting. Generous because a turn may be queued behind other lane work.
 */
const LANE_TURN_DEADLINE_MS = 120_000;

/** Rough token estimate for text about to be sent to a model: chars / 4. */
function estimateTokens(...texts: Array<string | undefined>): number {
  return Math.ceil(texts.reduce((total, text) => total + (text?.length ?? 0), 0) / 4);
}

interface ReminderLaneTurnArgs {
  agent: Agent;
  /** The PARENT session thread id; the lane thread key is derived from it. */
  parentThreadId: string;
  resourceId: string;
  prompt: string;
  requestContext?: RequestContext;
  maxSteps?: number;
  deadlineMs?: number;
  /**
   * Rejects the waiter when aborted. The lane turn itself is NOT cancelled — it completes and its
   * transcript persists in order; only the caller stops waiting.
   */
  abortSignal?: AbortSignal;
}

/**
 * Run one serialized turn on the reminder lane.
 *
 * Every entry point — blocking asks, detached asks, and passive reminder evaluations — funnels
 * through this helper, which enqueues the prompt as a message signal on the reminder thread via
 * `Agent.queueMessage`. The core thread-stream runtime owns serialization: an idle lane wakes one
 * run immediately, a busy lane queues the message and wakes it when the current run finishes, and
 * cross-process wake races resolve to a single owner. Each turn therefore reads the latest lane
 * history, executes alone, and persists its user/assistant messages in causal order — the "one
 * continuing conversation" contract.
 *
 * The completion callback rides in the queued entry's stream options, so each turn resolves its
 * own waiter. The correlation is in-process: if another process wins the wake race and executes
 * the turn, the transcript still persists in order, but this waiter falls to the deadline.
 */
function runReminderLaneTurn(args: ReminderLaneTurnArgs): Promise<string> {
  const threadId = remindThreadKey(args.parentThreadId);
  const deadlineMs = args.deadlineMs ?? LANE_TURN_DEADLINE_MS;
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`The reminder lane did not complete this turn within ${deadlineMs}ms.`));
    }, deadlineMs);
    // The waiter must never outlive the host process just to keep a deadline armed.
    (timer as { unref?: () => void }).unref?.();
    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('The caller aborted while waiting for the reminder lane turn.'));
    };
    if (args.abortSignal?.aborted) {
      onAbort();
      return;
    }
    args.abortSignal?.addEventListener('abort', onAbort, { once: true });
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    try {
      const result = args.agent.queueMessage(args.prompt, {
        threadId,
        resourceId: args.resourceId,
        ifIdle: {
          streamOptions: {
            requestContext: args.requestContext,
            maxSteps: args.maxSteps,
            onFinish: event => finish(() => resolve((event.text ?? '').trim())),
          },
        },
      });
      // `accepted` settles at routing-decision time. A rejection means the signal could not be
      // routed at all; a `blocked` disposition means the turn will never run, so both reject the
      // waiter immediately instead of burning the full deadline. A run failing AFTER it started
      // does not resolve `onFinish`, so the deadline above is the terminal backstop for that.
      result.accepted
        .then((disposition: { action?: string; reason?: string } | undefined) => {
          if (disposition?.action === 'blocked') {
            finish(() =>
              reject(new Error(`The reminder lane refused this turn: ${disposition.reason ?? 'thread-blocked'}.`)),
            );
          }
        })
        .catch((error: unknown) => finish(() => reject(error)));
    } catch (error) {
      finish(() => reject(error));
    }
  });
}

/**
 * The reminder agent as an agent-facing tool. The main agent asks a natural language question and
 * either waits for the answer or takes a correlation id back and receives the answer later as a
 * signal. Both dispositions enter the same serialized reminder lane the passive path uses, so a
 * question and its answer become part of the one conversation.
 */
export function createRemindAskTool(options: RemindAskToolOptions) {
  const { memory, config, omModel } = options;

  const answer = async (question: string, context: AskToolContext, threadId: string, abortSignal?: AbortSignal) => {
    const scope = resolveScope({
      requestContext: context.requestContext,
      resourceId: context.agent?.resourceId,
      threadId,
    });
    const instructions = [DEFAULT_INSTRUCTIONS, ASK_INSTRUCTIONS, config.instructions?.trim()]
      .filter(Boolean)
      .join('\n\n');
    const prompt = `Current time: ${new Date().toISOString()}\n\nQuestion: ${question}`;
    const model = await resolveReminderLaneModel({
      config,
      omModel,
      requestContext: context.requestContext,
      estimatedInputTokens: estimateTokens(instructions, prompt),
    });
    if (!model) {
      throw new ReminderUnavailableError(NO_MODEL_MESSAGE);
    }
    const remindMemory = options.createRemindMemory?.();
    const agent = new Agent({
      id: `subconscious-remind-${threadId}`,
      name: 'Subconscious Remind',
      instructions,
      model,
      ...(remindMemory ? { memory: remindMemory } : {}),
      tools: createKnowledgeTools(memory, scope),
    });
    return await runReminderLaneTurn({
      agent,
      parentThreadId: threadId,
      resourceId: laneResourceId(threadId, context.agent?.resourceId),
      prompt,
      requestContext: context.requestContext,
      maxSteps: config.maxSteps,
      abortSignal,
    });
  };

  const sendAnswerSignal = async (
    sender: SignalSender,
    args: { threadId: string; resourceId: string; correlationId: string; question: string; contents: string },
  ) => {
    const result = sender.sendSignal(
      createSignal({
        id: `__subconscious_remembered_${crypto.randomUUID()}`,
        type: 'reactive',
        tagName: 'remembered',
        contents: args.contents,
        createdAt: new Date(),
        metadata: { origin: 'subconscious' },
        attributes: {
          source: 'subconscious',
          agent: 'remind',
          threadId: args.threadId,
          // Names the question this answer belongs to. Without it a late answer arriving after the
          // conversation moved on is unattributable, which is the whole point of `wait: false`.
          correlationId: args.correlationId,
          question: args.question,
        },
      }),
      { threadId: args.threadId, resourceId: args.resourceId },
    );
    // Await the persist write when the sender exposes one. When it does not, resolving here does
    // NOT mean the answer is durable — delivery stays best-effort and in-process, and the tool's
    // acceptance wording says exactly that rather than implying a durable queue.
    await result?.persisted;
  };

  const askMemory = createTool({
    id: 'ask_memory',
    description:
      'Ask the reminder agent a question in natural language about what this session already knows or discussed, for example "when did that happen". It remembers this session\'s earlier reminders and questions, so follow-ups that refer back to an earlier turn resolve. Set wait to false to keep working and receive the answer later as a signal carrying the returned correlationId. Detached answers are best-effort and in-process only: if this process exits before the answer lands, it is lost.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', minLength: 1, description: 'The question, in natural language.' },
        wait: {
          type: 'boolean',
          description:
            'True (default) blocks and returns the answer. False returns immediately with a correlationId; the answer arrives later as a signal carrying the same id.',
        },
      },
      required: ['question'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, rawContext) => {
      const { question, wait = true } = input as { question: string; wait?: boolean };
      const context = rawContext as AskToolContext;
      const threadId = context.agent?.threadId;
      if (!threadId) {
        return { ok: false, error: 'ask_memory requires an active threadId.' };
      }

      if (wait) {
        try {
          // The abort signal is wired ONLY here: a detached answer must outlive the asking turn,
          // so wiring it there would cancel the answer the moment the run finishes.
          return { ok: true, answer: await answer(question, context, threadId, context.abortSignal) };
        } catch (error) {
          // Never throw out of the main agent's turn; hand it a result it can reason about.
          return { ok: false, ...describeAskFailure(error) };
        }
      }

      // The registry lookup can itself fail; a broken registry is a tool error, not a thrown turn.
      let sender: SignalSender | undefined;
      try {
        sender = await resolveSignalSender(context);
      } catch (error) {
        return { ok: false, ...describeAskFailure(error) };
      }
      const resourceId = context.agent?.resourceId;
      if (!sender || !resourceId) {
        return {
          ok: false,
          error:
            'ask_memory cannot answer without blocking here: no signal channel is reachable from this tool call. Retry with wait set to true.',
        };
      }

      // Pre-flight the failure that is deterministic at ask time, so a doomed question is an
      // honest error now rather than a correlation id that never resolves. Model availability is
      // re-checked inside `answer` on the lane turn itself.
      try {
        resolveScope({ requestContext: context.requestContext, resourceId, threadId });
      } catch (error) {
        return { ok: false, ...describeAskFailure(error) };
      }

      const correlationId = `remind-ask-${crypto.randomUUID()}`;
      void (async () => {
        try {
          const text = await answer(question, context, threadId);
          await sendAnswerSignal(sender, {
            threadId,
            resourceId,
            correlationId,
            question,
            contents: text,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          // No `writer.custom` survives past the tool's own turn, so a late failure reports on the
          // same signal channel the answer would have used, carrying the correlation id that names
          // the question it failed to answer.
          await Promise.resolve(
            context.writer?.custom({ type: 'data-subconscious-error', data: { agent: 'remind', error: message } }),
          ).catch(() => {});
          await sendAnswerSignal(sender, {
            threadId,
            resourceId,
            correlationId,
            question,
            contents: `Could not answer that question: ${message}`,
          }).catch(() => {});
        }
      })().catch(() => {
        // Nothing above may reject: this lane runs after the asking turn returned, so an escaping
        // rejection would surface as an unhandled rejection in the host process.
      });

      return {
        ok: true,
        accepted: true,
        correlationId,
        note: 'Best effort: the answer is delivered in-process as a remembered signal carrying this correlationId. If the process exits first, the answer is lost and never retried.',
      };
    },
  });

  return { ask_memory: askMemory } satisfies Record<string, ToolAction<any, any, any, any, any, any, any>>;
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
          const sources = await dropFreshOwnItems(
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
          const model = await resolveReminderLaneModel({
            config,
            omModel,
            mainAgent: context.mainAgent,
            requestContext: context.requestContext,
            estimatedInputTokens: estimateTokens(instructions, prompt),
          });
          if (!model) return;
          // One reminder conversation per main-agent session. The thread key is derived from the
          // PARENT thread id, not from the agent id above, and matches the curate/learn convention.
          // The evaluation enters the same serialized lane as asks, so a passive reminder never
          // interleaves with an in-flight question turn.
          const remindMemory = options?.createRemindMemory?.();
          const agent = new Agent({
            id: `subconscious-remind-${context.threadId}`,
            name: 'Subconscious Remind',
            instructions,
            model,
            ...(remindMemory ? { memory: remindMemory } : {}),
            tools: createKnowledgeTools(context.memory, scope),
          });
          const reminder = await runReminderLaneTurn({
            agent,
            parentThreadId: context.threadId,
            resourceId: laneResourceId(context.threadId, context.resourceId),
            prompt,
            requestContext: context.requestContext,
            maxSteps: config.maxSteps,
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

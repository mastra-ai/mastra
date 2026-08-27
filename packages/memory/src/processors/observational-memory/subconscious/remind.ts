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
import type { RemindLane, RemindRequestRecord, RemindRequestResult } from './remind-request-state';
import { LANE_TURN_DEADLINE_MS, RemindRequestRegistry } from './remind-request-state';
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
   * session that never reminds never builds one, and called again for every lane turn rather than
   * cached: a cached instance would pin the model of whichever session reminded first. Persisted
   * continuity is unaffected, because the observational record and its locks are keyed by the thread,
   * not by the instance; only in-process caches are rebuilt with it.
   */
  createRemindMemory?: () => Memory;
  /**
   * Correlated request registry shared by every reminder agent this Memory creates. A question may be
   * delivered into an already-running reminder turn, so the run that answers it is not necessarily the
   * run that received it — only a shared registry can settle the right request.
   */
  registry?: RemindRequestRegistry;
}

const ASK_INSTRUCTIONS = `The main agent is asking you direct questions. This is a conversation, not an observation run: answer the question.

Every question arrives with a correlationId. Answer it by calling reply_to_memory_question exactly once with that exact correlationId and your answer — plain text in the response is not delivered to the asker. Several questions may arrive during one turn; answer each one with its own correlationId.

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

/** Rough token estimate for text about to be sent to a model: chars / 4. */
function estimateTokens(...texts: Array<string | undefined>): number {
  return Math.ceil(texts.reduce((total, text) => total + (text?.length ?? 0), 0) / 4);
}

/**
 * The reminder agent's answer channel, and the ONLY authority that can complete a question
 * successfully. A run finishing with text says nothing about which question it answered — a turn may
 * service several questions or none — so success is claimed explicitly against a correlation id.
 *
 * Lane ownership is validated against the trusted execution context, never against model input: the
 * model supplies the correlation id, the runtime supplies the thread and resource the reply came from.
 */
function createReplyTool(registry: RemindRequestRegistry, lane: RemindLane) {
  return createTool({
    id: 'reply_to_memory_question',
    description:
      'Deliver the answer to a question the main agent asked. Call this exactly once per question with the correlationId that came with it. This is the only way an answer reaches the asker.',
    inputSchema: {
      type: 'object',
      properties: {
        correlationId: { type: 'string', minLength: 1, description: 'The correlationId that came with the question.' },
        answer: { type: 'string', minLength: 1, description: 'The answer, in natural language.' },
      },
      required: ['correlationId', 'answer'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async (input, rawContext) => {
      const { correlationId, answer } = input as { correlationId: string; answer: string };
      const context = rawContext as AskToolContext;
      if (context.agent?.threadId !== lane.remindThreadId || context.agent?.resourceId !== lane.resourceId) {
        return { ok: false, error: `reply_to_memory_question was called outside the lane that owns ${correlationId}.` };
      }

      // Deliberately uncaught: settlement is a map lookup and two comparisons, so a throw here is our
      // bug, not a state the caller can reach. Swallowing it into a terminal status would invent a
      // state nothing outside this process can produce; let it surface and leave the deadline as the
      // backstop that stops the asker waiting forever.
      const completion = registry.complete(correlationId, { ok: true, correlationId, status: 'replied', answer }, lane);
      switch (completion.outcome) {
        case 'settled':
          return { ok: true, correlationId, delivered: true };
        case 'duplicate':
          // An exact retry of an answer already delivered. Idempotent: nothing is emitted twice.
          return { ok: true, correlationId, delivered: true, duplicate: true };
        default:
          return {
            ok: false,
            correlationId,
            error:
              completion.reason === 'unknown'
                ? `No open question with correlationId ${correlationId}. It may have timed out already.`
                : completion.reason === 'wrong_lane'
                  ? `Question ${correlationId} belongs to another conversation.`
                  : `Question ${correlationId} was already answered with a different result.`,
          };
      }
    },
  });
}

/**
 * The one reminder agent factory. Asks and passive reminder evaluations build the same agent with the
 * same toolset: a question can be delivered into a run that a passive evaluation started, and that run
 * must be able to answer it.
 */
function createReminderAgent(args: {
  parentThreadId: string;
  lane: RemindLane;
  instructions: string;
  model: NonNullable<Awaited<ReturnType<typeof resolveReminderLaneModel>>>;
  memory: Memory;
  scope: KnowledgeScope;
  registry: RemindRequestRegistry;
  remindMemory?: Memory;
}): Agent {
  return new Agent({
    id: `subconscious-remind-${args.parentThreadId}`,
    name: 'Subconscious Remind',
    instructions: args.instructions,
    model: args.model,
    ...(args.remindMemory ? { memory: args.remindMemory } : {}),
    tools: {
      ...createKnowledgeTools(args.memory, args.scope),
      reply_to_memory_question: createReplyTool(args.registry, args.lane),
    },
  });
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
 * Run one serialized turn on the reminder lane, for the passive reminder evaluation only.
 *
 * Asks do not come through here. A passive evaluation wants the turn's final text, so it can afford
 * to own a run and read what that run said; a question cannot, because the lane's runs are shared and
 * one run may carry several questions. Asks therefore mint a correlation id and dispatch through
 * `sendMessage` (see `createRemindAskTool`), and their answers come back through the reply tool
 * rather than from any run's output.
 *
 * What both paths share is the thread: this helper enqueues the prompt as a message signal on the
 * reminder thread via `Agent.queueMessage`, and the core thread-stream runtime owns serialization —
 * an idle lane wakes one run immediately, a busy lane queues the message and wakes it when the
 * current run finishes, and cross-process wake races resolve to a single owner while the pubsub lease is
 * healthy — the lease fails open, so an outage can let two processes start a turn. Each turn therefore
 * reads the latest lane history, executes alone, and persists its user/assistant messages in causal
 * order — the "one continuing conversation" contract that keeps a question and a passive reminder
 * from talking over each other.
 *
 * The completion callback rides in the queued entry's stream options, so this turn resolves its own
 * waiter. That is in-process: if another process wins the wake race and executes the turn, the
 * transcript still persists in order, but this waiter falls to the deadline.
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
    const onAbort = () =>
      finish(() => reject(new Error('The caller aborted while waiting for the reminder lane turn.')));
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      args.abortSignal?.removeEventListener('abort', onAbort);
      fn();
    };
    if (args.abortSignal?.aborted) {
      onAbort();
      return;
    }
    args.abortSignal?.addEventListener('abort', onAbort, { once: true });
    try {
      const result = args.agent.queueMessage(args.prompt, {
        threadId,
        resourceId: args.resourceId,
        ifIdle: {
          streamOptions: {
            requestContext: args.requestContext,
            maxSteps: args.maxSteps,
            onFinish: event => finish(() => resolve((event.text ?? '').trim())),
            // A run that fails after it started reports here; without it the waiter would burn
            // the full deadline on an ordinary model or tool failure.
            onError: ({ error }: { error: Error | string }) =>
              finish(() => reject(error instanceof Error ? error : new Error(String(error)))),
          },
        },
      });
      // `accepted` settles at routing-decision time. A rejection means the signal could not be
      // routed at all; a `blocked` disposition means the turn will never run, so both reject the
      // waiter immediately instead of burning the full deadline. A synchronous throw from stream
      // setup on the drain side never reaches these callbacks, so the deadline stays as the
      // terminal backstop for that residue.
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
  // Same fallback the passive path uses. A per-call registry here would put the ask tool and the
  // reminder agent that answers it on two different authorities whenever an owner wired none.
  const registry = options.registry ?? fallbackRegistry();

  /**
   * The single dispatch path. Blocking and detached asks differ only in what the caller does with the
   * returned record — the identity, the registration, and the delivery are identical.
   */
  const dispatch = async (
    question: string,
    context: AskToolContext,
    threadId: string,
  ): Promise<RemindRequestRecord> => {
    const scope = resolveScope({
      requestContext: context.requestContext,
      resourceId: context.agent?.resourceId,
      threadId,
    });
    const instructions = [DEFAULT_INSTRUCTIONS, ASK_INSTRUCTIONS, config.instructions?.trim()]
      .filter(Boolean)
      .join('\n\n');
    const model = await resolveReminderLaneModel({
      config,
      omModel,
      requestContext: context.requestContext,
      estimatedInputTokens: estimateTokens(instructions, question),
    });
    if (!model) {
      throw new ReminderUnavailableError(NO_MODEL_MESSAGE);
    }

    const lane: RemindLane = {
      remindThreadId: remindThreadKey(threadId),
      resourceId: laneResourceId(threadId, context.agent?.resourceId),
    };
    // Identity exists before anything is sent. Nothing the transport reports back — not a run id, not a
    // final text — is ever used to decide which question an *answer* belongs to. The run id is used only
    // in the other direction: to fail the questions a dying run was carrying.
    const correlationId = `remind-ask-${crypto.randomUUID()}`;
    const record = registry.create({ correlationId, question, lane, parentThreadId: threadId });

    // A run failure can fire before `accepted` resolves, so the run id and the failure meet on this token
    // rather than racing: whichever lands second applies the other.
    const token: { runId?: string; failure?: string } = {};
    const failRun = () => {
      if (!token.runId || !token.failure) return;
      for (const pendingId of registry.pendingForRun(token.runId)) {
        registry.complete(pendingId, {
          ok: false,
          correlationId: pendingId,
          status: 'model_failed',
          error: token.failure,
        });
      }
    };
    const failDelivery = (error: unknown) =>
      registry.complete(correlationId, {
        ok: false,
        correlationId,
        status: 'delivery_failed',
        error: error instanceof Error ? error.message : String(error),
      });

    try {
      // Built inside the guard: `createRemindMemory` reaches real storage and can throw, and a throw
      // out here would leave the record above pending until the deadline reaped it two minutes later.
      const agent = createReminderAgent({
        parentThreadId: threadId,
        lane,
        instructions,
        model,
        memory,
        scope,
        registry,
        remindMemory: options.createRemindMemory?.(),
      });

      const contents = `Current time: ${new Date().toISOString()}\n\nQuestion [correlationId: ${correlationId}]: ${question}\n\nAnswer this by calling reply_to_memory_question with correlationId "${correlationId}".`;

      const result = agent.sendMessage(
        {
          contents,
          metadata: {
            correlationId,
            kind: 'remind-ask',
            parentThreadId: threadId,
            remindThreadId: lane.remindThreadId,
          },
        },
        {
          threadId: lane.remindThreadId,
          resourceId: lane.resourceId,
          ifIdle: {
            streamOptions: {
              requestContext: context.requestContext,
              maxSteps: config.maxSteps,
              // Failure authority only: this closes questions this run was carrying, and never claims
              // success for any of them.
              onError: ({ error }: { error: Error | string }) => {
                token.failure = error instanceof Error ? error.message : String(error);
                failRun();
              },
            },
          },
        },
      );
      result.accepted
        .then((disposition: { action?: string; runId?: string; reason?: string } | undefined) => {
          if (disposition?.action === 'blocked' || disposition?.action === 'discard') {
            failDelivery(
              new Error(`The reminder lane refused this turn: ${disposition.reason ?? disposition.action}.`),
            );
            return;
          }
          // Defensive: a disposition with no run id leaves the request pending with the deadline as its
          // only backstop. This call site takes the runtime defaults (`wake` when idle, `deliver` when
          // busy), so it does not ask for the run-less `persist` behaviour today.
          if (disposition?.runId) {
            token.runId = disposition.runId;
            registry.associateRun(correlationId, disposition.runId);
            failRun();
          }
          // A woken run hands back an unconsumed stream: nothing executes until someone drains it, and
          // this lane agent is never registered with a Mastra instance, so nothing else will. Draining is
          // what lets the run reach `onError` above; it is not a second failure surface, because
          // `consumeStream` reports a dying stream through its own callback instead of rejecting. The
          // catch below is only for a synchronous throw out of the call itself.
          const output = (disposition as { output?: { consumeStream?: () => Promise<void> } } | undefined)?.output;
          void output?.consumeStream?.().catch((error: unknown) => {
            token.failure = error instanceof Error ? error.message : String(error);
            failRun();
          });
        })
        .catch(failDelivery);
    } catch (error) {
      failDelivery(error);
    }

    return record;
  };

  const sendAnswerSignal = async (
    sender: SignalSender,
    args: {
      threadId: string;
      resourceId: string;
      correlationId: string;
      question: string;
      status: string;
      contents: string;
    },
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
          /** The terminal state this delivery reports: `replied`, or one of the failure states. */
          status: args.status,
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
        let record: RemindRequestRecord;
        try {
          record = await dispatch(question, context, threadId);
        } catch (error) {
          // Never throw out of the main agent's turn; hand it a result it can reason about.
          return { ok: false, ...describeAskFailure(error) };
        }
        // Aborting stops this caller waiting. It does not cancel the lane run, and it settles only this
        // request: a question the same run is carrying for someone else is untouched.
        const onAbort = () =>
          registry.complete(record.correlationId, {
            ok: false,
            correlationId: record.correlationId,
            status: 'aborted',
            error: 'The caller aborted while waiting for the answer.',
          });
        if (context.abortSignal?.aborted) onAbort();
        else context.abortSignal?.addEventListener('abort', onAbort, { once: true });
        try {
          return await record.settled;
        } finally {
          context.abortSignal?.removeEventListener('abort', onAbort);
        }
      }

      // Resolving the sender goes through the Mastra *agent* registry, which can itself fail; a broken
      // lookup is a tool error, not a thrown turn.
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

      // Same dispatch as the blocking mode; the caller's abort is deliberately NOT wired, because a
      // detached answer must outlive the turn that asked for it.
      let record: RemindRequestRecord;
      try {
        record = await dispatch(question, context, threadId);
      } catch (error) {
        return { ok: false, ...describeAskFailure(error) };
      }

      if (record.status !== 'pending') {
        // Dispatch failed outright — the lane agent could not be built, or the transport refused the
        // message. Acknowledging "pending" here would be a lie the caller then waits on forever, and
        // routing it through the signal channel would announce a failure to a turn that is still on
        // the line to hear it directly.
        return await record.settled;
      }

      void record.settled
        .then(async (result: RemindRequestResult) => {
          // The registry already settled exactly once; this delivery only reports that result and cannot
          // reopen or re-settle it. Emission failure is a lost answer, not a second terminal state.
          if (!result.ok) {
            // No `writer.custom` survives past the tool's own turn, so a late failure reports on the
            // same signal channel the answer would have used, carrying the correlation id that names
            // the question it failed to answer.
            await Promise.resolve(
              context.writer?.custom({
                type: 'data-subconscious-error',
                data: { agent: 'remind', error: result.error },
              }),
            ).catch(() => {});
          }
          await sendAnswerSignal(sender, {
            threadId,
            resourceId,
            correlationId: result.correlationId,
            question,
            status: result.status,
            contents: result.ok ? result.answer : `Could not answer that question: ${result.error}`,
          });
        })
        .catch(() => {
          // This runs after the asking turn returned, so an escaping rejection would surface as an
          // unhandled rejection in the host process.
        });

      return {
        ok: true,
        accepted: true,
        correlationId: record.correlationId,
        status: 'pending' as const,
        note: 'Best effort: the answer is delivered in-process as a remembered signal carrying this correlationId. If the process exits first, the answer is lost and never retried.',
      };
    },
  });

  return { ask_memory: askMemory } satisfies Record<string, ToolAction<any, any, any, any, any, any, any>>;
}

/**
 * Registry used when the owner wired none. A reminder agent always carries the reply tool so its
 * toolset does not change shape between wake reasons; without a shared registry a reply simply finds
 * no matching request and is rejected, which is the correct answer for a question nobody asked here.
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
          const agent = createReminderAgent({
            parentThreadId: context.threadId,
            lane: {
              remindThreadId: remindThreadKey(context.threadId),
              resourceId: laneResourceId(context.threadId, context.resourceId),
            },
            instructions,
            model,
            memory: context.memory,
            scope,
            // A question can be delivered into this passive run, so it must carry the same reply
            // authority an ask-woken run has.
            registry: options?.registry ?? fallbackRegistry(),
            remindMemory: options?.createRemindMemory?.(),
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

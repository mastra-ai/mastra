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
import { resolveSubconsciousAgentModel } from './model';
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

/** The reminder agent's thread key. Derived from the PARENT thread id, never from the agent id. */
function remindThreadKey(threadId: string): string {
  return `subconscious:${threadId}:remind`;
}

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
 * The reminder agent as an agent-facing tool. The main agent asks a natural language question and
 * either waits for the answer or takes a correlation id back and receives the answer later as a
 * signal. Both dispositions talk on the same thread the passive reminder path uses, so a question
 * and its answer become part of the one conversation.
 */
export function createRemindAskTool(options: RemindAskToolOptions) {
  const { memory, config, omModel } = options;

  const resolveModel = (context: AskToolContext) =>
    resolveSubconsciousAgentModel({ config, omModel, requestContext: context.requestContext });

  const answer = async (
    question: string,
    context: AskToolContext,
    threadId: string,
    blocking: boolean,
    preResolvedModel?: Awaited<ReturnType<typeof resolveModel>>,
  ) => {
    const scope = resolveScope({
      requestContext: context.requestContext,
      resourceId: context.agent?.resourceId,
      threadId,
    });
    const model = preResolvedModel ?? (await resolveModel(context));
    if (!model) {
      throw new ReminderUnavailableError(NO_MODEL_MESSAGE);
    }
    const remindMemory = options.createRemindMemory?.();
    const agent = new Agent({
      id: `subconscious-remind-${threadId}`,
      name: 'Subconscious Remind',
      instructions: [DEFAULT_INSTRUCTIONS, ASK_INSTRUCTIONS, config.instructions?.trim()].filter(Boolean).join('\n\n'),
      model,
      ...(remindMemory ? { memory: remindMemory } : {}),
      tools: createKnowledgeTools(memory, scope),
    });
    const result = await agent.generate(`Current time: ${new Date().toISOString()}\n\nQuestion: ${question}`, {
      requestContext: context.requestContext,
      // A non-blocking answer outlives the turn that asked for it. Wiring it to that turn's abort
      // signal would cancel the answer the moment the run finishes, leaving the caller holding a
      // correlation id that can never resolve.
      ...(blocking ? { abortSignal: context.abortSignal } : {}),
      maxSteps: config.maxSteps,
      ...(remindMemory
        ? { memory: { thread: remindThreadKey(threadId), resource: context.agent?.resourceId ?? threadId } }
        : {}),
    });
    return result.text.trim();
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
    await result?.persisted;
  };

  const askMemory = createTool({
    id: 'ask_memory',
    description:
      'Ask the reminder agent a question in natural language about what this session already knows or discussed, for example "when did that happen". It remembers this session\'s earlier reminders and questions, so follow-ups that refer back to an earlier turn resolve. Set wait to false to keep working and receive the answer later as a signal carrying the returned correlationId.',
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
          return { ok: true, answer: await answer(question, context, threadId, true) };
        } catch (error) {
          // Never throw out of the main agent's turn; hand it a result it can reason about.
          return { ok: false, ...describeAskFailure(error) };
        }
      }

      const sender = await resolveSignalSender(context);
      const resourceId = context.agent?.resourceId;
      if (!sender || !resourceId) {
        return {
          ok: false,
          error:
            'ask_memory cannot answer without blocking here: no signal channel is reachable from this tool call. Retry with wait set to true.',
        };
      }

      // Pre-flight the two things that fail deterministically, so a doomed question is an honest
      // error now rather than a correlation id that never resolves.
      let model: Awaited<ReturnType<typeof resolveModel>>;
      try {
        resolveScope({ requestContext: context.requestContext, resourceId, threadId });
        model = await resolveModel(context);
        if (!model) throw new ReminderUnavailableError(NO_MODEL_MESSAGE);
      } catch (error) {
        return { ok: false, ...describeAskFailure(error) };
      }

      const correlationId = `remind-ask-${crypto.randomUUID()}`;
      void (async () => {
        try {
          const text = await answer(question, context, threadId, false, model);
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
        note: 'The answer will arrive as a remembered signal carrying this correlationId.',
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
          const model = await resolveSubconsciousAgentModel({
            config,
            omModel,
            mainAgent: context.mainAgent,
            requestContext: context.requestContext,
          });
          if (!model) return;
          // One reminder conversation per main-agent session. The thread key is derived from the
          // PARENT thread id, not from the agent id above, and matches the curate/learn convention.
          const remindMemory = options?.createRemindMemory?.();
          const agent = new Agent({
            id: `subconscious-remind-${context.threadId}`,
            name: 'Subconscious Remind',
            instructions: [DEFAULT_INSTRUCTIONS, config.instructions?.trim()].filter(Boolean).join('\n\n'),
            model,
            ...(remindMemory ? { memory: remindMemory } : {}),
            tools: createKnowledgeTools(context.memory, scope),
          });
          const recentMessagesSection = context.recentMessages?.trim()
            ? `\n\nRecent conversation messages (already visible to the agent — never remind about anything present here):\n${context.recentMessages}`
            : '';
          const result = await agent.generate(
            `Current time: ${new Date().toISOString()}\n\nScoped source candidates:\n${JSON.stringify(sources)}\n\nCurrent observations:\n${context.rawObservations}${recentMessagesSection}`,
            {
              requestContext: context.requestContext,
              abortSignal: context.abortSignal,
              maxSteps: config.maxSteps,
              ...(remindMemory
                ? {
                    memory: {
                      thread: remindThreadKey(context.threadId),
                      // A reminder always has a thread; a resource is optional on the observation
                      // path, so fall back to the thread to keep the conversation addressable.
                      resource: context.resourceId ?? context.threadId,
                    },
                  }
                : {}),
            },
          );
          const reminder = result.text.trim();
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

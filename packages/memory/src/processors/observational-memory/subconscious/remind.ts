import type { KnowledgeScope, KnowledgeStorage, SearchKnowledgeResult } from '@mastra/core/storage';
import { canonicalizeKnowledgeScope } from '@mastra/core/storage';

import { Extractor } from '../extractor';
import { withOmInternalThreadId } from '../internal-request-context';
import type { ObservationalMemoryModel } from '../types';
import { publishSubconsciousActivity } from './activity';
import { resolveSubconsciousAgentModel } from './model';
import { createReminderAgent } from './remind-agent';
import { ensureOwnedRemindThread, getRemindThreadId, REMIND_MESSAGE_METADATA_KEY } from './remind-protocol';
import { createReplyToMemoryQuestionTool } from './remind-questions';
import { resolveKnowledgeResourceId } from './scope';
import type { ResolvedSubconsciousAgent } from './types';

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
 * Drop the current thread's own freshly curated KnowledgeRecords from the candidate list. They match the
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
      // KnowledgeRecords written by the thread's own subconscious sub-agents carry a
      // `subconscious:<threadId>:<agent>` source — they are this thread's too.
      const isOwnThread =
        record.sourceThreadId === threadId || record.sourceThreadId.startsWith(`subconscious:${threadId}:`);
      const isFresh = Date.now() - new Date(record.capturedAt).getTime() < FRESH_OWN_RECORD_WINDOW_MS;
      return !(isOwnThread && isFresh);
    }),
  );
  return sources.filter((_, index) => checks[index]);
}

export class SubconsciousRemindExtractor extends Extractor<string> {
  constructor(config: ResolvedSubconsciousAgent, omModel?: ObservationalMemoryModel) {
    super({
      name: 'Remind',
      mode: 'hook',
      metadataKeyPath: false,
      onExtracted: async context => {
        if (!context.rawObservations?.trim() || !context.memory || !context.sendSignal) return;

        let scope: KnowledgeScope | undefined;
        let store: KnowledgeStorage | undefined;
        try {
          scope = resolveScope(context);
          const resourceId = resolveKnowledgeResourceId(context.requestContext, context.resourceId)!;
          store = await context.memory.storage.getStore('knowledge');
          if (!store) throw new Error('Subconscious remind requires a configured knowledge storage domain.');
          const sources = await dropFreshOwnRecords(
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

          const remindMemory = context.memory.createSubconsciousMemory();
          const remindThread = await ensureOwnedRemindThread({
            memory: remindMemory,
            parentThreadId: context.threadId,
            resourceId,
          });
          const eventId = `subconscious:remind:${crypto.randomUUID()}:event`;
          const createdAt = Date.now();
          const candidateIds = [
            ...new Set(
              sources
                .flatMap(source => [source.id, source.recordId])
                .filter((id): id is string => typeof id === 'string'),
            ),
          ];
          const recentMessages = context.recentMessages?.trim() || '(none)';
          const replyTool = context.mainAgent
            ? createReplyToMemoryQuestionTool({
                parentAgent: context.mainAgent,
                parentThreadId: context.threadId,
                resourceId,
              })
            : undefined;
          const agent = createReminderAgent({
            model,
            memory: remindMemory,
            scope,
            threadId: remindThread.id,
            resourceId,
            parentThreadId: context.threadId,
            parentAgent: context.mainAgent,
            fallbackSendSignal: context.sendSignal,
            additionalTools: replyTool ? { reply_to_memory_question: replyTool } : undefined,
            instructions: config.instructions,
            maxSteps: config.maxSteps,
          });
          const delivery = agent.sendMessage(
            {
              contents: `Passive reminder check ${eventId}\n\nCurrent time: ${new Date(createdAt).toISOString()}\n\nScoped source candidates:\n${JSON.stringify(sources)}\n\nCurrent observations:\n${context.rawObservations}\n\nRecent conversation messages already visible to the parent agent:\n${recentMessages}`,
              metadata: {
                [REMIND_MESSAGE_METADATA_KEY]: { type: 'passive-check', eventId, candidateIds },
              },
            },
            {
              resourceId,
              threadId: remindThread.id,
              ifActive: { behavior: 'deliver' },
              ifIdle: {
                behavior: 'wake',
                streamOptions: {
                  memory: { thread: remindThread.id, resource: resourceId },
                  requestContext: withOmInternalThreadId(context.requestContext, agent.id),
                  abortSignal: context.abortSignal,
                  maxSteps: config.maxSteps,
                },
              },
            },
          );
          const accepted = await delivery.accepted;
          if (accepted.action === 'wake') await accepted.output.consumeStream();
          if (accepted.action !== 'wake' && accepted.action !== 'deliver') {
            throw new Error(`Reminder event ${eventId} was not accepted for processing (${accepted.action}).`);
          }
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

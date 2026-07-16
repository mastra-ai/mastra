import { Agent } from '@mastra/core/agent';
import type { KnowledgeScope, KnowledgeStorage, SearchKnowledgeResult } from '@mastra/core/storage';
import { canonicalizeKnowledgeScope } from '@mastra/core/storage';

import { Extractor } from '../extractor';
import { publishSubconsciousActivity } from './activity';
import { createKnowledgeTools } from './knowledge-tools';
import type { ResolvedSubconsciousAgent } from './types';

const NO_REMINDER = '<no-reminder />';
const DEFAULT_INSTRUCTIONS = `Review the current observations and use the knowledge tools to find prior knowledge that is directly relevant now.

Be selective. Treat future-dated facts as relevant when their time is imminent or useful to the current task. When the observations show whether an earlier reminder was used, tune your selectivity accordingly without storing hit/miss counters.
If nothing is relevant, respond with exactly ${NO_REMINDER} and nothing else.
If knowledge is relevant, return one concise reminder that explains why it matters and includes source record or fact IDs. Do not invent knowledge and do not expose knowledge outside the tools' scoped results.`;

function resolveScope(context: {
  requestContext?: { get(key: string): unknown };
  resourceId?: string;
  threadId: string;
}) {
  const organizationId = context.requestContext?.get('organizationId');
  if (typeof organizationId !== 'string' || !organizationId.trim()) {
    throw new Error('Subconscious remind requires organizationId in the request context.');
  }
  if (!context.resourceId) {
    throw new Error('Subconscious remind requires a resourceId.');
  }

  return canonicalizeKnowledgeScope([
    `org:${organizationId}`,
    `resource:${context.resourceId}`,
    `thread:${context.threadId}`,
  ]);
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

export class SubconsciousRemindExtractor extends Extractor<string> {
  constructor(config: ResolvedSubconsciousAgent) {
    super({
      name: 'Remind',
      mode: 'hook',
      metadataKeyPath: false,
      onExtracted: async context => {
        if (!context.rawObservations?.trim() || !context.memory || !context.mainAgent || !context.sendSignal) {
          return;
        }

        let scope: KnowledgeScope | undefined;
        let store: KnowledgeStorage | undefined;
        try {
          scope = resolveScope(context);
          store = await context.memory.storage.getStore('knowledge');
          if (!store) throw new Error('Subconscious remind requires a configured knowledge storage domain.');
          const sources = await findReminderSources(store, scope, context.rawObservations);
          const model = await context.mainAgent.getModel({
            requestContext: context.requestContext,
            ...(config.model ? { modelConfig: config.model } : {}),
          });
          const agent = new Agent({
            id: `subconscious-remind-${context.threadId}`,
            name: 'Subconscious Remind',
            instructions: [DEFAULT_INSTRUCTIONS, config.instructions?.trim()].filter(Boolean).join('\n\n'),
            model,
            tools: createKnowledgeTools(context.memory, scope),
          });
          const result = await agent.generate(
            `Current time: ${new Date().toISOString()}\n\nScoped source candidates:\n${JSON.stringify(sources)}\n\nCurrent observations:\n${context.rawObservations}`,
            {
              requestContext: context.requestContext,
              abortSignal: context.abortSignal,
              maxSteps: config.maxSteps,
            },
          );
          const reminder = result.text.trim();
          if (!reminder || /^<no-reminder\s*\/>$/i.test(reminder)) {
            return;
          }

          const candidateIds = [...new Set(sources.flatMap(source => [source.id, source.recordId]))];
          const referencedIds = candidateIds.filter(id => reminder.includes(id));
          const sourceIds = (referencedIds.length ? referencedIds : candidateIds).slice(0, 5);
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

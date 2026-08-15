import { Agent } from '@mastra/core/agent';
import type { KnowledgeScope, KnowledgeStorage } from '@mastra/core/storage';
import { canonicalizeKnowledgeScope } from '@mastra/core/storage';

import type { Memory } from '../../..';
import type { ReflectionCommittedContext } from '../types';
import { publishSubconsciousActivity, publishSubconsciousError } from './activity';
import { createKnowledgeTools } from './knowledge-tools';
import { createKnowledgeWriteTools } from './knowledge-write-tools';
import { createPinnedTools } from './pinned';
import type { ResolvedSubconsciousAgent, ResolvedSubconsciousConfig } from './types';

const CURATION_AGENT = 'curate';
const DEFAULT_INSTRUCTIONS = `Maintain durable scoped knowledge from the committed observation worklist.

Use the read tools to inspect existing nodes, KnowledgeItems, mentions, backlinks, and long-form node content. Use the write tools to merge true duplicates, repair names and links, soft-delete superseded KnowledgeItems, rescope KnowledgeItems only when justified and permitted by their ceilings, and synthesize useful node content. Never restore deleted KnowledgeItems. Never invent provenance, capture timestamps, scopes, ceilings, IDs, or versions; those are enforced by code. Resolve optimistic-concurrency conflicts by reading the latest record and retrying the intended mutation. Keep the reserved capture-guidance node concise and update it only with durable guidance that will improve future capture.

Process the worklist in ID order. Your final response must end with <curation-complete through="ITEM_ID" /> using the ID of the last KnowledgeItem you fully processed. If you cannot finish the batch, acknowledge only the last KnowledgeItem you did finish. Do not emit a completion marker when no KnowledgeItem was fully processed.`;

const PINNED_INSTRUCTIONS = `Maintain the pin set with knowledge_pin, knowledge_edit_pin, and knowledge_unpin. Pinned entries are delivered to the main agent on every turn, so they cost tokens permanently and must stay short. Pin only knowledge that should apply without being asked for, such as standing instructions, durable preferences, and hard constraints. Unpin an entry as soon as it stops being unconditionally true. Everything a reminder can surface on demand does not belong in the pin set.`;

function resolveScope(context: ReflectionCommittedContext): KnowledgeScope {
  const organizationId = context.requestContext?.get('organizationId');
  if (typeof organizationId !== 'string' || !organizationId.trim()) {
    throw new Error('Subconscious curate requires organizationId in the request context.');
  }
  return canonicalizeKnowledgeScope([
    `org:${organizationId}`,
    `resource:${context.resourceId}`,
    `thread:${context.parentThreadId}`,
  ]);
}

async function readWorklist(store: KnowledgeStorage, sourceThreadId: string, scope: KnowledgeScope, after?: string) {
  const items = [];
  let cursor = after;
  do {
    const page = await store.listItemsBySource({
      sourceThreadId,
      scope,
      after: cursor,
      limit: 100,
      includeDeleted: true,
    });
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor && items.length < 500);
  return { items, hasMore: Boolean(cursor) };
}

export function createCuratorHandler(
  memory: Memory,
  subconscious: ResolvedSubconsciousConfig,
  curatorMemory = memory,
): (context: ReflectionCommittedContext) => Promise<void> {
  const config = subconscious.reflection.find(agent => agent.name === CURATION_AGENT);
  if (!config) return async () => {};

  return async context => {
    let store: KnowledgeStorage | undefined;
    let scope: KnowledgeScope | undefined;
    try {
      scope = resolveScope(context);
      store = await memory.storage.getStore('knowledge');
      if (!store) throw new Error('Subconscious curate requires a configured knowledge storage domain.');

      const cursor = await store.getCurationCursor({ sourceThreadId: context.parentThreadId, agent: CURATION_AGENT });
      const worklist = await readWorklist(store, context.parentThreadId, scope, cursor?.lastItemId);
      if (!worklist.items.length && !context.observations.trim()) return;

      const agent = await createCuratorAgent(memory, curatorMemory, context, scope, config, subconscious);
      const result = await agent.generate(
        `Parent thread: ${context.parentThreadId}\nCurrent time: ${new Date().toISOString()}\nWorklist truncated: ${worklist.hasMore}\n\nCommitted pre-reflection observations:\n${context.observations}\n\nNew KnowledgeItem worklist:\n${JSON.stringify(worklist.items)}`,
        {
          requestContext: context.requestContext,
          abortSignal: context.abortSignal,
          maxSteps: config.maxSteps,
          memory: {
            thread: `subconscious:${context.parentThreadId}:curate`,
            resource: context.resourceId,
          },
        },
      );

      if (worklist.items.length) {
        const acknowledgedId = result.text.match(/<curation-complete\s+through=["']([^"']+)["']\s*\/>/i)?.[1];
        if (!acknowledgedId || !worklist.items.some(item => item.id === acknowledgedId)) {
          throw new Error('Curator did not acknowledge a valid processed KnowledgeItem cursor.');
        }
        await store.advanceCurationCursor({
          sourceThreadId: context.parentThreadId,
          agent: CURATION_AGENT,
          lastItemId: acknowledgedId,
        });
      }
    } catch (error) {
      const message = `curate: ${error instanceof Error ? error.message : String(error)}`;
      await context.writer?.custom({ type: 'data-subconscious-error', data: { agent: 'curate', error: message } });
      if (store && scope) {
        await publishSubconsciousActivity({
          store,
          scope,
          recentUpdates: subconscious.activity === false ? 10 : subconscious.activity.recentUpdates,
          sendStateSignal: context.sendStateSignal,
          errors: [message],
        });
      } else {
        await publishSubconsciousError({ error: message, sendStateSignal: context.sendStateSignal });
      }
      throw error;
    }
  };
}

async function createCuratorAgent(
  memory: Memory,
  curatorMemory: Memory,
  context: ReflectionCommittedContext,
  scope: KnowledgeScope,
  config: ResolvedSubconsciousAgent,
  subconscious: ResolvedSubconsciousConfig,
): Promise<Agent> {
  if (!context.mainAgent) throw new Error('Subconscious curate requires the main agent to resolve its model.');
  const model = await context.mainAgent.getModel({
    requestContext: context.requestContext,
    ...(config.model ? { modelConfig: config.model } : {}),
  });
  return new Agent({
    id: `subconscious-curate-${context.parentThreadId}`,
    name: 'Subconscious Curate',
    instructions: [
      DEFAULT_INSTRUCTIONS,
      subconscious.pins ? PINNED_INSTRUCTIONS : undefined,
      config.instructions?.trim(),
    ]
      .filter(Boolean)
      .join('\n\n'),
    model,
    memory: curatorMemory,
    tools: {
      ...createKnowledgeTools(memory),
      ...createKnowledgeWriteTools(memory, {
        scope,
        sourceThreadId: context.parentThreadId,
        defaultScope: subconscious.defaultScope,
        maxScope: subconscious.maxScope,
      }),
      ...(subconscious.pins
        ? createPinnedTools(memory, {
            scope,
            sourceThreadId: context.parentThreadId,
            defaultScope: subconscious.defaultScope,
            maxScope: subconscious.maxScope,
            maxPins: subconscious.pins.maxPins,
            maxCharacters: subconscious.pins.maxCharacters,
          })
        : {}),
    },
  });
}

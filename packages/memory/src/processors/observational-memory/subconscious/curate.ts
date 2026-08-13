import { Agent } from '@mastra/core/agent';
import type { KnowledgeScope, KnowledgeStorage } from '@mastra/core/storage';
import { canonicalizeKnowledgeScope } from '@mastra/core/storage';

import type { Memory } from '../../..';
import type { ObservationalMemoryModel, ReflectionCommittedContext } from '../types';
import { publishSubconsciousActivity, publishSubconsciousError } from './activity';
import { createKnowledgeTools } from './knowledge-tools';
import { createKnowledgeWriteTools } from './knowledge-write-tools';
import { resolveSubconsciousAgentModel } from './model';
import { createPinnedTools } from './pinned';
import { resolveKnowledgeResourceId } from './scope';
import type { ResolvedSubconsciousAgent, ResolvedSubconsciousConfig } from './types';

const CURATION_AGENT = 'curate';
const DEFAULT_INSTRUCTIONS = `Maintain durable scoped knowledge from the committed observation worklist.

Use the read tools to inspect existing entities, facts, mentions, backlinks, and pages. Use the write tools to merge true duplicates, repair names and links, soft-delete superseded facts, rescope facts only when justified and permitted by their ceilings, and synthesize useful pages. Never restore deleted facts. Never invent provenance, capture timestamps, scopes, ceilings, IDs, or versions; those are enforced by code. Resolve optimistic-concurrency conflicts by reading the latest record and retrying the intended mutation. Keep the reserved capture-guidance page concise and update it only with durable guidance that will improve future capture.

Process the worklist in ID order. Every time you finish processing a fact, include <curation-complete through="FACT_ID" /> in your very next text response with that fact's ID, replacing the previous marker as you go; the latest marker you emit is your acknowledged cursor, so progress survives even if you run out of steps mid-batch. Your final response must end with the marker for the last fact you fully processed. If you cannot finish the batch, acknowledge only the last fact you did finish. Do not emit a completion marker when no fact was fully processed.`;

export const PINNED_INSTRUCTIONS = `Maintain the pin set with knowledge_pin, knowledge_edit_pin, and knowledge_unpin. Pinned entries are delivered to the main agent on every turn, so they cost tokens permanently and must stay short. Pin only knowledge that should apply without being asked for, such as standing instructions, durable preferences, and hard constraints. Pin only knowledge that is BOTH costly to rediscover AND not the kind of thing a future agent would think to search for; anything a reminder can surface on demand does not belong in the pin set. Unpin an entry as soon as it stops being unconditionally true.`;

function resolveScope(context: ReflectionCommittedContext): KnowledgeScope {
  const organizationId = context.requestContext?.get('organizationId');
  if (typeof organizationId !== 'string' || !organizationId.trim()) {
    throw new Error('Subconscious curate requires organizationId in the request context.');
  }
  return canonicalizeKnowledgeScope([
    `org:${organizationId}`,
    `resource:${resolveKnowledgeResourceId(context.requestContext, context.resourceId)}`,
    `thread:${context.parentThreadId}`,
  ]);
}

async function readWorklist(store: KnowledgeStorage, sourceThreadId: string, scope: KnowledgeScope, after?: string) {
  const facts = [];
  let cursor = after;
  do {
    const page = await store.listFactsBySource({
      sourceThreadId,
      scope,
      after: cursor,
      limit: 100,
      includeDeleted: true,
    });
    facts.push(...page.facts);
    cursor = page.nextCursor;
  } while (cursor && facts.length < 500);
  return { facts, hasMore: Boolean(cursor) };
}

export function createCuratorHandler(
  memory: Memory,
  subconscious: ResolvedSubconsciousConfig,
  curatorMemory = memory,
  options?: { omModel?: ObservationalMemoryModel },
): (context: ReflectionCommittedContext) => Promise<'ran' | 'no-op'> {
  const config = subconscious.reflection.find(agent => agent.name === CURATION_AGENT);
  if (!config) return async () => 'no-op';

  return async context => {
    let store: KnowledgeStorage | undefined;
    let scope: KnowledgeScope | undefined;
    try {
      scope = resolveScope(context);
      store = await memory.storage.getStore('knowledge');
      if (!store) throw new Error('Subconscious curate requires a configured knowledge storage domain.');

      const cursor = await store.getCurationCursor({ sourceThreadId: context.parentThreadId, agent: CURATION_AGENT });
      const worklist = await readWorklist(store, context.parentThreadId, scope, cursor?.lastFactId);
      if (!worklist.facts.length && !context.observations.trim()) return 'no-op';

      const agent = await createCuratorAgent(
        memory,
        curatorMemory,
        context,
        scope,
        config,
        subconscious,
        options?.omModel,
      );
      const result = await agent.generate(
        `Parent thread: ${context.parentThreadId}\nCurrent time: ${new Date().toISOString()}\nWorklist truncated: ${worklist.hasMore}\n\nCommitted pre-reflection observations:\n${context.observations}\n\nNew fact worklist:\n${JSON.stringify(worklist.facts)}`,
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

      if (worklist.facts.length) {
        // Markers are emitted incrementally as facts are processed; the LAST one is the
        // acknowledged cursor, so partial progress survives step exhaustion mid-batch.
        const markers = [...result.text.matchAll(/<curation-complete\s+through=["']([^"']+)["']\s*\/>/gi)];
        const acknowledgedId = markers.at(-1)?.[1];
        if (!acknowledgedId || !worklist.facts.some(fact => fact.id === acknowledgedId)) {
          throw new Error('Curator did not acknowledge a valid processed fact cursor.');
        }
        await store.advanceCurationCursor({
          sourceThreadId: context.parentThreadId,
          agent: CURATION_AGENT,
          lastFactId: acknowledgedId,
        });
      }
      return 'ran';
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
  omModel?: ObservationalMemoryModel,
): Promise<Agent> {
  const model = await resolveSubconsciousAgentModel({
    config,
    omModel,
    mainAgent: context.mainAgent,
    requestContext: context.requestContext,
  });
  if (!model) throw new Error('Subconscious curate requires the main agent to resolve its model.');
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
      ...createKnowledgeTools(memory, scope),
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

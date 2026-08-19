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

Use the read tools to inspect existing nodes, knowledge records, mentions, backlinks, and long-form node content. Use the write tools to merge true duplicates, repair names and links, soft-delete superseded knowledge records, rescope knowledge records only when justified and permitted by their ceilings, and synthesize useful node content. Never restore deleted knowledge records. Never invent provenance, capture timestamps, scopes, ceilings, IDs, or versions; those are enforced by code. Resolve optimistic-concurrency conflicts by reading the latest record and retrying the intended mutation. Keep the reserved capture-guidance node concise and update it only with durable guidance that will improve future capture.

For each significant entity node touched by a KnowledgeRecord in the current worklist, including people, projects, pull requests, issues, repositories, documents, and organizations, maintain concise node content; do not walk nodes outside the worklist for this. Use the supplied record and read the named node once; do not search or browse unless its identity is ambiguous. Describe what the entity is, its current state, and links to its real-world object. Then use knowledge_write_node_content at its most specific existing scope level; pass expectedVersion when updating it, omit expectedVersion only when creating it, and re-read then retry after a version conflict. Include links only from the entity's own records or observations that explicitly associate the link with that entity; never invent a URL, identifier, file path, or provenance. Refine only the affected parts as new records arrive rather than rewriting content wholesale. Keep descriptions to a few sentences plus a links line. For entity-description maintenance only, skip low-signal nodes with only a trivial record, any system-kind node, and the reserved capture-guidance node.

Process the worklist in ID order. Every time you finish processing a KnowledgeRecord, include <curation-complete through="RECORD_ID" /> in your next text response with that record's ID. The latest marker is your acknowledged cursor, so progress survives if you run out of steps mid-batch. Your final response must end with the marker for the last KnowledgeRecord you fully processed. If you cannot finish the batch, acknowledge only the last KnowledgeRecord you did finish. Do not emit a completion marker when no KnowledgeRecord was fully processed.`;

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
  const records = [];
  let cursor = after;
  do {
    const page = await store.knowledgeBySource({
      sourceThreadId,
      scope,
      after: cursor,
      limit: 100,
      includeDeleted: true,
    });
    records.push(...page.records);
    cursor = page.nextCursor;
  } while (cursor && records.length < 500);
  return { records, hasMore: Boolean(cursor) };
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
      const worklist = await readWorklist(store, context.parentThreadId, scope, cursor?.lastKnowledgeId);
      if (!worklist.records.length && !context.observations.trim()) return 'no-op';

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
        `Parent thread: ${context.parentThreadId}\nCurrent time: ${new Date().toISOString()}\nWorklist truncated: ${worklist.hasMore}\n\nCommitted pre-reflection observations:\n${context.observations}\n\nNew KnowledgeRecord worklist:\n${JSON.stringify(worklist.records)}`,
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

      if (worklist.records.length) {
        const markers = [...result.text.matchAll(/<curation-complete\s+through=["']([^"']+)["']\s*\/>/gi)];
        const acknowledgedId = markers.at(-1)?.[1];
        if (!acknowledgedId || !worklist.records.some(record => record.id === acknowledgedId)) {
          throw new Error('Curator did not acknowledge a valid processed KnowledgeRecord cursor.');
        }
        await store.advanceCurationCursor({
          sourceThreadId: context.parentThreadId,
          agent: CURATION_AGENT,
          lastKnowledgeId: acknowledgedId,
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

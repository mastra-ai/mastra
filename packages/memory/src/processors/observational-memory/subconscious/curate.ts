import { Agent } from '@mastra/core/agent';
import type { KnowledgeScope, KnowledgeStorage } from '@mastra/core/storage';
import { canonicalizeKnowledgeScope } from '@mastra/core/storage';

import type { Memory } from '../../..';
import type { ReflectionCommittedContext } from '../types';
import { publishSubconsciousActivity, publishSubconsciousError } from './activity';
import { createKnowledgeTools } from './knowledge-tools';
import { createKnowledgeWriteTools } from './knowledge-write-tools';
import type { ResolvedSubconsciousAgent, ResolvedSubconsciousConfig } from './types';

const CURATION_AGENT = 'curate';
const DEFAULT_INSTRUCTIONS = `Maintain durable scoped knowledge from the committed observation worklist.

Use the read tools to inspect existing entities, facts, mentions, backlinks, and pages. Use the write tools to merge true duplicates, repair names and links, soft-delete superseded facts, rescope facts only when justified and permitted by their ceilings, and synthesize useful pages. Never restore deleted facts. Never invent provenance, capture timestamps, scopes, ceilings, IDs, or versions; those are enforced by code. Resolve optimistic-concurrency conflicts by reading the latest record and retrying the intended mutation. Keep the reserved capture-guidance page concise and update it only with durable guidance that will improve future capture.

Process the worklist in ID order. Your final response must end with <curation-complete through="FACT_ID" /> using the ID of the last fact you fully processed. If you cannot finish the batch, acknowledge only the last fact you did finish. Do not emit a completion marker when no fact was fully processed.`;

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
      const worklist = await readWorklist(store, context.parentThreadId, scope, cursor?.lastFactId);
      if (!worklist.facts.length && !context.observations.trim()) return;

      const agent = await createCuratorAgent(memory, curatorMemory, context, scope, config, subconscious);
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
        const acknowledgedId = result.text.match(/<curation-complete\s+through=["']([^"']+)["']\s*\/>/i)?.[1];
        if (!acknowledgedId || !worklist.facts.some(fact => fact.id === acknowledgedId)) {
          throw new Error('Curator did not acknowledge a valid processed fact cursor.');
        }
        await store.advanceCurationCursor({
          sourceThreadId: context.parentThreadId,
          agent: CURATION_AGENT,
          lastFactId: acknowledgedId,
        });
      }
    } catch (error) {
      const message = `curate: ${error instanceof Error ? error.message : String(error)}`;
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
    instructions: [DEFAULT_INSTRUCTIONS, config.instructions?.trim()].filter(Boolean).join('\n\n'),
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
    },
  });
}

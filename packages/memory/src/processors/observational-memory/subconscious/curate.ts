import { Agent } from '@mastra/core/agent';
import type { KnowledgeScope } from '@mastra/core/storage';
import { canonicalizeKnowledgeScope } from '@mastra/core/storage';

import type { Memory } from '../../..';
import type { ObservationCommittedContext } from '../observation-strategies/types';
import type { ObservationalMemoryModel } from '../types';
import { createKnowledgeTools } from './knowledge-tools';
import { createKnowledgeWriteTools } from './knowledge-write-tools';
import { resolveSubconsciousAgentModel } from './model';
import { createPinnedTools } from './pinned';
import { resolveKnowledgeResourceId } from './scope';
import type { ResolvedSubconsciousAgent, ResolvedSubconsciousConfig } from './types';

const CURATION_AGENT = 'curate';
const DEFAULT_INSTRUCTIONS = `Maintain durable scoped knowledge from the current completed observations.

First identify the durable facts, preferences, constraints, entities, relationships, and meaningful changes in the supplied observations. Before mutating knowledge, use the read tools to find relevant existing nodes and records so you can reconcile new information instead of duplicating it. Ignore transient chatter and facts already represented accurately.

Use the write tools to create new knowledge, append facts, merge true duplicates, repair names and links, soft-delete superseded records, rescope records only when justified and permitted by their ceilings, and synthesize useful node content. Never restore deleted records. Never invent provenance, capture timestamps, source thread IDs, scopes, ceilings, IDs, versions, activity identities, or semantic-index operations; those are enforced by code. Resolve optimistic-concurrency conflicts by reading the latest node and retrying the intended mutation.

For significant entity nodes, maintain a short description of what the entity is, its current state, and links explicitly supported by the observations or existing records. Keep descriptions concise and put long-form detail in node content. Do not manufacture URLs, identifiers, dates, or relationships.`;

export const PINNED_INSTRUCTIONS = `Maintain the pin set with knowledge_pin, knowledge_edit_pin, and knowledge_unpin. Pinned entries are delivered to the main agent on every turn, so they cost tokens permanently and must stay short. Pin only knowledge that should apply without being asked for, such as standing instructions, durable preferences, and hard constraints. Pin only knowledge that is BOTH costly to rediscover AND not the kind of thing a future agent would think to search for; anything a reminder can surface on demand does not belong in the pin set. Unpin an entry as soon as it stops being unconditionally true.`;

function resolveScope(context: ObservationCommittedContext): KnowledgeScope {
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

export function createObservationCuratorHandler(
  memory: Memory,
  subconscious: ResolvedSubconsciousConfig,
  curatorMemory = memory,
  options?: { omModel?: ObservationalMemoryModel },
): (context: ObservationCommittedContext) => Promise<'ran' | 'no-op'> {
  const config = subconscious.observation.find(agent => agent.name === CURATION_AGENT);
  if (!config) return async () => 'no-op';

  return async context => {
    if (!context.observations.trim()) return 'no-op';

    // Runs as memory-owned background work after the observation commit, so there is no turn
    // writer, state-signal sink, or turn abort signal to report through. Failures propagate to the
    // scheduling boundary, which logs them; the persisted observation is never affected.
    const scope = resolveScope(context);
    const store = await memory.storage.getStore('knowledge');
    if (!store) throw new Error('Subconscious curate requires a configured knowledge storage domain.');

    const agent = await createCuratorAgent(
      memory,
      curatorMemory,
      context,
      scope,
      config,
      subconscious,
      options?.omModel,
    );
    await agent.generate(
      `Parent thread: ${context.parentThreadId}\nResource: ${context.resourceId}\nCurrent time: ${new Date().toISOString()}\n\nCompleted observations to curate:\n${context.observations}`,
      {
        requestContext: context.requestContext,
        maxSteps: config.maxSteps,
        memory: {
          thread: `subconscious:${context.parentThreadId}:curate`,
          resource: context.resourceId,
        },
      },
    );
    return 'ran';
  };
}

async function createCuratorAgent(
  memory: Memory,
  curatorMemory: Memory,
  context: ObservationCommittedContext,
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

import { createHash } from 'node:crypto';

import { Agent } from '@mastra/core/agent';
import type { KnowledgeItem, KnowledgeScope, KnowledgeStorage } from '@mastra/core/storage';
import { canonicalizeKnowledgeScope, expandKnowledgeScope } from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

import type { Memory } from '../../..';
import type { ObservationalMemoryModel, ReflectionCommittedContext } from '../types';
import { publishSubconsciousActivity, publishSubconsciousError } from './activity';
import { createKnowledgeTools } from './knowledge-tools';
import { createKnowledgeWriteTools } from './knowledge-write-tools';
import { resolveSubconsciousAgentModel } from './model';
import { resolveKnowledgeResourceId } from './scope';
import type { ResolvedSubconsciousAgent, ResolvedSubconsciousConfig } from './types';

const LEARN_AGENT = 'learn';
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DEFAULT_INSTRUCTIONS = `Learn reusable skills from the full pre-reflection observations and pending knowledge items.

A skill is a repeatable procedure with ordered actions, a trigger or context, and a success or recovery outcome. Do not learn one-off events, isolated preferences, knowledge items, or procedures supported by fewer than two distinct pending knowledge items. Search existing kind:skill nodes by exact name before writing so updates extend one skill rather than creating duplicates.

Use knowledge_record_skill for every skill creation or evidence update. It validates the evidence frontier and writes retry-safe evidence. You may use the other scoped knowledge tools for research and maintenance, but never restore deleted items, invent provenance or versions, or write outside the source scope.

Process pending items in ID order. End with <learning-complete through="ITEM_ID" /> naming the last pending item you reviewed, even when no reusable skill was found. Acknowledge only items you fully reviewed.`;

type LearnerState = { recordedName?: string };

function resolveScope(context: ReflectionCommittedContext): KnowledgeScope {
  const organizationId = context.requestContext?.get('organizationId');
  if (typeof organizationId !== 'string' || !organizationId.trim()) {
    throw new Error('Subconscious learn requires organizationId in the request context.');
  }
  return canonicalizeKnowledgeScope([
    `org:${organizationId}`,
    `resource:${resolveKnowledgeResourceId(context.requestContext, context.resourceId)}`,
    `thread:${context.parentThreadId}`,
  ]);
}

async function readWorklist(store: KnowledgeStorage, sourceThreadId: string, scope: KnowledgeScope, after?: string) {
  const items: KnowledgeItem[] = [];
  let cursor = after;
  do {
    const page = await store.listItemsBySource({ sourceThreadId, scope, after: cursor, limit: 100 });
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor && items.length < 500);
  return { items, hasMore: Boolean(cursor) };
}

function evidenceItemId(sourceItemId: string, skillName: string): string {
  const hash = createHash('sha256').update(`${skillName.trim().toLocaleLowerCase()}\0${sourceItemId}`).digest();
  let suffix = '';
  for (let index = 0; index < 16; index++) suffix += ULID_ALPHABET[hash[index]! & 31];
  return `${sourceItemId.slice(0, 10)}${suffix}`;
}

export function createLearnerRecordSkillTool(input: {
  store: KnowledgeStorage;
  scope: KnowledgeScope;
  pendingItems: KnowledgeItem[];
  parentThreadId: string;
  defaultScope: ResolvedSubconsciousConfig['defaultScope'];
  maxScope: ResolvedSubconsciousConfig['maxScope'];
  state: LearnerState;
}): ToolAction<any, any, any> {
  return createTool({
    id: 'knowledge_record_skill',
    description:
      'Create or update one reusable skill using at least two distinct pending knowledge items. Evidence writes are idempotent across retries.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        procedure: { type: 'string', minLength: 1 },
        sourceItemIds: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 2, uniqueItems: true },
      },
      required: ['name', 'procedure', 'sourceItemIds'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async raw => {
      const value = raw as { name: string; procedure: string; sourceItemIds: string[] };
      const sourceIds = [...new Set(value.sourceItemIds)];
      const pending = new Map(input.pendingItems.map(item => [item.id, item]));
      if (sourceIds.length < 2 || sourceIds.some(id => !pending.has(id))) {
        throw new Error('Skill evidence requires at least two distinct items from the pending learner worklist.');
      }
      const normalizedName = value.name.trim();
      if (
        input.state.recordedName &&
        input.state.recordedName.toLocaleLowerCase() !== normalizedName.toLocaleLowerCase()
      ) {
        throw new Error('The learner may record at most one skill per reflection.');
      }
      input.state.recordedName = normalizedName;
      const nodeScope = expandKnowledgeScope(input.scope, input.defaultScope);
      let node = await input.store.resolveNode({ name: normalizedName, scope: input.scope });
      if (node && node.kind !== 'skill') throw new Error(`Knowledge node is not a skill: ${normalizedName}`);
      node ??= await input.store.createNode({ name: normalizedName, kind: 'skill', scope: nodeScope });
      const evidence = [];
      for (const sourceId of sourceIds) {
        const id = evidenceItemId(sourceId, normalizedName);
        const existing = await input.store.getItem({ id });
        if (existing) {
          evidence.push(existing);
          continue;
        }
        const source = pending.get(sourceId)!;
        try {
          evidence.push(
            await input.store.appendItem({
              id,
              parentNodeId: node.id,
              text: `Procedure: ${value.procedure.trim()} Evidence source: ${source.id}.`,
              scope: source.scope,
              sourceThreadId: `subconscious:${input.parentThreadId}:learn`,
              maxScope: source.maxScope ?? input.maxScope,
              resolutionScope: input.scope,
              defaultScope: nodeScope,
            }),
          );
        } catch (error) {
          const raced = await input.store.getItem({ id });
          if (!raced) throw error;
          evidence.push(raced);
        }
      }
      return { node, evidence };
    },
  });
}

export function composeReflectionAgentHandlers(
  handlers: Array<(context: ReflectionCommittedContext) => Promise<unknown>>,
): (context: ReflectionCommittedContext) => Promise<void> {
  return async context => {
    for (const handler of handlers) {
      try {
        await handler(context);
      } catch (error) {
        if (context.abortSignal?.aborted) throw error;
        // Each handler reports its own failure; reflection agents must remain independent.
      }
    }
  };
}

export function createLearnerHandler(
  memory: Memory,
  subconscious: ResolvedSubconsciousConfig,
  learnerMemory = memory,
  options?: { omModel?: ObservationalMemoryModel },
): (context: ReflectionCommittedContext) => Promise<void> {
  const config = subconscious.reflection.find(agent => agent.name === LEARN_AGENT);
  if (!config) return async () => {};
  return async context => {
    let store: KnowledgeStorage | undefined;
    let scope: KnowledgeScope | undefined;
    try {
      scope = resolveScope(context);
      store = await memory.storage.getStore('knowledge');
      if (!store) throw new Error('Subconscious learn requires a configured knowledge storage domain.');
      const cursor = await store.getCurationCursor({ sourceThreadId: context.parentThreadId, agent: LEARN_AGENT });
      const worklist = await readWorklist(store, context.parentThreadId, scope, cursor?.lastItemId);
      if (!worklist.items.length) return;
      const agent = await createLearnerAgent(
        memory,
        learnerMemory,
        context,
        scope,
        worklist.items,
        config,
        subconscious,
        options?.omModel,
      );
      const result = await agent.generate(
        `Parent thread: ${context.parentThreadId}\nCurrent time: ${new Date().toISOString()}\nWorklist truncated: ${worklist.hasMore}\n\nFull pre-reflection observations:\n${context.observations}\n\nPending knowledge items:\n${JSON.stringify(worklist.items)}`,
        {
          requestContext: context.requestContext,
          abortSignal: context.abortSignal,
          maxSteps: config.maxSteps,
          memory: { thread: `subconscious:${context.parentThreadId}:learn`, resource: context.resourceId },
        },
      );
      const acknowledgedId = result.text.match(/<learning-complete\s+through=["']([^"']+)["']\s*\/>/i)?.[1];
      if (!acknowledgedId || !worklist.items.some(item => item.id === acknowledgedId)) {
        throw new Error('Learner did not acknowledge a valid reviewed item cursor.');
      }
      await store.advanceCurationCursor({
        sourceThreadId: context.parentThreadId,
        agent: LEARN_AGENT,
        lastItemId: acknowledgedId,
      });
    } catch (error) {
      const message = `learn: ${error instanceof Error ? error.message : String(error)}`;
      await context.writer?.custom({ type: 'data-subconscious-error', data: { agent: 'learn', error: message } });
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

async function createLearnerAgent(
  memory: Memory,
  learnerMemory: Memory,
  context: ReflectionCommittedContext,
  scope: KnowledgeScope,
  pendingItems: KnowledgeItem[],
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
  if (!model) throw new Error('Subconscious learn requires the main agent to resolve its model.');
  const store = await memory.storage.getStore('knowledge');
  if (!store) throw new Error('Subconscious learn requires a configured knowledge storage domain.');
  const state: LearnerState = {};
  return new Agent({
    id: `subconscious-learn-${context.parentThreadId}`,
    name: 'Subconscious Learn',
    instructions: [DEFAULT_INSTRUCTIONS, config.instructions?.trim()].filter(Boolean).join('\n\n'),
    model,
    memory: learnerMemory,
    tools: {
      ...createKnowledgeTools(memory, scope),
      ...createKnowledgeWriteTools(memory, {
        scope,
        sourceThreadId: context.parentThreadId,
        defaultScope: subconscious.defaultScope,
        maxScope: subconscious.maxScope,
      }),
      knowledge_record_skill: createLearnerRecordSkillTool({
        store,
        scope,
        pendingItems,
        parentThreadId: context.parentThreadId,
        defaultScope: subconscious.defaultScope,
        maxScope: subconscious.maxScope,
        state,
      }),
    },
  });
}

import { createHash } from 'node:crypto';

import { Agent } from '@mastra/core/agent';
import type { KnowledgeFact, KnowledgeScope, KnowledgeStorage } from '@mastra/core/storage';
import { canonicalizeKnowledgeScope, expandKnowledgeScope } from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from 'json-schema';

import type { Memory } from '../../..';
import type { ReflectionCommittedContext } from '../types';
import { publishSubconsciousActivity, publishSubconsciousError } from './activity';
import { createKnowledgeTools } from './knowledge-tools';
import { createKnowledgeWriteTools } from './knowledge-write-tools';
import type { ResolvedSubconsciousAgent, ResolvedSubconsciousConfig } from './types';

const LEARN_AGENT = 'learn';
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DEFAULT_INSTRUCTIONS = `Learn reusable skills from the full pre-reflection observations and pending source facts.

A skill is a repeatable procedure with ordered actions, a trigger or context, and a success or recovery outcome. Do not learn one-off events, isolated preferences, facts, or procedures supported by fewer than two distinct pending source facts. Search existing kind:skill entities by exact name before writing so updates extend one skill rather than creating duplicates.

Use knowledge_record_skill for every skill creation or evidence update. It validates the evidence frontier and writes retry-safe evidence. You may use the other scoped knowledge tools for research and maintenance, but never restore deleted facts, invent provenance or versions, or write outside the source scope.

Process pending facts in ID order. End with <learning-complete through="FACT_ID" /> naming the last pending fact you reviewed, even when no reusable skill was found. Acknowledge only facts you fully reviewed.`;

type LearnerState = { recordedName?: string };

function resolveScope(context: ReflectionCommittedContext): KnowledgeScope {
  const organizationId = context.requestContext?.get('organizationId');
  if (typeof organizationId !== 'string' || !organizationId.trim()) {
    throw new Error('Subconscious learn requires organizationId in the request context.');
  }
  return canonicalizeKnowledgeScope([
    `org:${organizationId}`,
    `resource:${context.resourceId}`,
    `thread:${context.parentThreadId}`,
  ]);
}

async function readWorklist(store: KnowledgeStorage, sourceThreadId: string, scope: KnowledgeScope, after?: string) {
  const facts: KnowledgeFact[] = [];
  let cursor = after;
  do {
    const page = await store.listFactsBySource({ sourceThreadId, scope, after: cursor, limit: 100 });
    facts.push(...page.facts);
    cursor = page.nextCursor;
  } while (cursor && facts.length < 500);
  return { facts, hasMore: Boolean(cursor) };
}

function evidenceFactId(sourceFactId: string, skillName: string): string {
  const hash = createHash('sha256').update(`${skillName.trim().toLocaleLowerCase()}\0${sourceFactId}`).digest();
  let suffix = '';
  for (let index = 0; index < 16; index++) suffix += ULID_ALPHABET[hash[index]! & 31];
  return `${sourceFactId.slice(0, 10)}${suffix}`;
}

export function createLearnerRecordSkillTool(input: {
  store: KnowledgeStorage;
  scope: KnowledgeScope;
  pendingFacts: KnowledgeFact[];
  parentThreadId: string;
  defaultScope: ResolvedSubconsciousConfig['defaultScope'];
  maxScope: ResolvedSubconsciousConfig['maxScope'];
  state: LearnerState;
}): ToolAction<any, any, any> {
  return createTool({
    id: 'knowledge_record_skill',
    description:
      'Create or update one reusable skill using at least two distinct pending source facts. Evidence writes are idempotent across retries.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        procedure: { type: 'string', minLength: 1 },
        sourceFactIds: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 2, uniqueItems: true },
      },
      required: ['name', 'procedure', 'sourceFactIds'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async raw => {
      const value = raw as { name: string; procedure: string; sourceFactIds: string[] };
      const sourceIds = [...new Set(value.sourceFactIds)];
      const pending = new Map(input.pendingFacts.map(fact => [fact.id, fact]));
      if (sourceIds.length < 2 || sourceIds.some(id => !pending.has(id))) {
        throw new Error('Skill evidence requires at least two distinct facts from the pending learner worklist.');
      }
      const normalizedName = value.name.trim();
      if (
        input.state.recordedName &&
        input.state.recordedName.toLocaleLowerCase() !== normalizedName.toLocaleLowerCase()
      ) {
        throw new Error('The learner may record at most one skill per reflection.');
      }
      input.state.recordedName = normalizedName;
      const entityScope = expandKnowledgeScope(input.scope, input.defaultScope);
      let entity = await input.store.resolveEntity({ name: normalizedName, scope: input.scope });
      if (entity && entity.kind !== 'skill') throw new Error(`Knowledge entity is not a skill: ${normalizedName}`);
      entity ??= await input.store.createEntity({ name: normalizedName, kind: 'skill', scope: entityScope });
      const evidence = [];
      for (const sourceId of sourceIds) {
        const id = evidenceFactId(sourceId, normalizedName);
        const existing = await input.store.getFact({ id });
        if (existing) {
          evidence.push(existing);
          continue;
        }
        const source = pending.get(sourceId)!;
        try {
          evidence.push(
            await input.store.appendFact({
              id,
              parentEntityId: entity.id,
              text: `Procedure: ${value.procedure.trim()} Evidence source: ${source.id}.`,
              scope: source.scope,
              sourceThreadId: `subconscious:${input.parentThreadId}:learn`,
              maxScope: source.maxScope ?? input.maxScope,
              resolutionScope: input.scope,
              defaultScope: entityScope,
            }),
          );
        } catch (error) {
          const raced = await input.store.getFact({ id });
          if (!raced) throw error;
          evidence.push(raced);
        }
      }
      return { entity, evidence };
    },
  });
}

export function composeReflectionAgentHandlers(
  handlers: Array<(context: ReflectionCommittedContext) => Promise<void>>,
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
      const worklist = await readWorklist(store, context.parentThreadId, scope, cursor?.lastFactId);
      if (!worklist.facts.length) return;
      const agent = await createLearnerAgent(
        memory,
        learnerMemory,
        context,
        scope,
        worklist.facts,
        config,
        subconscious,
      );
      const result = await agent.generate(
        `Parent thread: ${context.parentThreadId}\nCurrent time: ${new Date().toISOString()}\nWorklist truncated: ${worklist.hasMore}\n\nFull pre-reflection observations:\n${context.observations}\n\nPending source facts:\n${JSON.stringify(worklist.facts)}`,
        {
          requestContext: context.requestContext,
          abortSignal: context.abortSignal,
          maxSteps: config.maxSteps,
          memory: { thread: `subconscious:${context.parentThreadId}:learn`, resource: context.resourceId },
        },
      );
      const acknowledgedId = result.text.match(/<learning-complete\s+through=["']([^"']+)["']\s*\/>/i)?.[1];
      if (!acknowledgedId || !worklist.facts.some(fact => fact.id === acknowledgedId)) {
        throw new Error('Learner did not acknowledge a valid reviewed fact cursor.');
      }
      await store.advanceCurationCursor({
        sourceThreadId: context.parentThreadId,
        agent: LEARN_AGENT,
        lastFactId: acknowledgedId,
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
  pendingFacts: KnowledgeFact[],
  config: ResolvedSubconsciousAgent,
  subconscious: ResolvedSubconsciousConfig,
): Promise<Agent> {
  if (!context.mainAgent) throw new Error('Subconscious learn requires the main agent to resolve its model.');
  const model = await context.mainAgent.getModel({
    requestContext: context.requestContext,
    ...(config.model ? { modelConfig: config.model } : {}),
  });
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
        pendingFacts,
        parentThreadId: context.parentThreadId,
        defaultScope: subconscious.defaultScope,
        maxScope: subconscious.maxScope,
        state,
      }),
    },
  });
}

import { createHash } from 'node:crypto';

import { Agent } from '@mastra/core/agent';
import type { KnowledgeRecord, KnowledgeScope, KnowledgeStorage } from '@mastra/core/storage';
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
const DEFAULT_INSTRUCTIONS = `Learn reusable skills from the full pre-reflection observations and pending knowledge records.

A skill is a repeatable procedure with ordered actions, a trigger or context, and a success or recovery outcome. Do not learn one-off events, isolated preferences, knowledge records, or procedures supported by fewer than two distinct pending knowledge records. Search existing kind:skill nodes by exact name before writing so updates extend one skill rather than creating duplicates.

Use knowledge_record_skill for every skill creation or evidence update. It validates the evidence frontier and writes retry-safe evidence. You may use the other scoped knowledge tools for research and maintenance, but never restore deleted records, invent provenance or versions, or write outside the source scope.

Process pending records in ID order. End with <learning-complete through="RECORD_ID" /> naming the last pending record you reviewed, even when no reusable skill was found. Acknowledge only records you fully reviewed.`;

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

/** Upper bound on records pulled into a single reflection prompt; `hasMore` signals truncation. */
const MAX_WORKLIST_RECORDS = 1000;

async function readWorklist(store: KnowledgeStorage, sourceThreadId: string, scope: KnowledgeScope, after?: string) {
  const records: KnowledgeRecord[] = [];
  let cursor = after;
  do {
    const page = await store.knowledgeBySource({ sourceThreadId, scope, after: cursor, limit: 100 });
    records.push(...page.records);
    cursor = page.nextCursor;
  } while (cursor && records.length < MAX_WORKLIST_RECORDS);
  return { records, hasMore: Boolean(cursor) };
}

function evidenceRecordId(sourceRecordId: string, skillName: string): string {
  const hash = createHash('sha256').update(`${skillName.trim().toLocaleLowerCase()}\0${sourceRecordId}`).digest();
  let suffix = '';
  for (let index = 0; index < 16; index++) suffix += ULID_ALPHABET[hash[index]! & 31];
  return `${sourceRecordId.slice(0, 10)}${suffix}`;
}

export function createLearnerRecordSkillTool(input: {
  store: KnowledgeStorage;
  scope: KnowledgeScope;
  pendingRecords: KnowledgeRecord[];
  parentThreadId: string;
  defaultScope: ResolvedSubconsciousConfig['defaultScope'];
  maxScope: ResolvedSubconsciousConfig['maxScope'];
  state: LearnerState;
}): ToolAction<any, any, any> {
  return createTool({
    id: 'knowledge_record_skill',
    description:
      'Create or update one reusable skill using at least two distinct pending knowledge records. Evidence writes are idempotent across retries.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        procedure: { type: 'string', minLength: 1 },
        sourceRecordIds: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 2, uniqueItems: true },
      },
      required: ['name', 'procedure', 'sourceRecordIds'],
      additionalProperties: false,
    } satisfies JSONSchema7,
    execute: async raw => {
      const value = raw as { name: string; procedure: string; sourceRecordIds: string[] };
      const sourceIds = [...new Set(value.sourceRecordIds)];
      const pending = new Map(input.pendingRecords.map(record => [record.id, record]));
      if (sourceIds.length < 2 || sourceIds.some(id => !pending.has(id))) {
        throw new Error('Skill evidence requires at least two distinct records from the pending learner worklist.');
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
        const id = evidenceRecordId(sourceId, normalizedName);
        const existing = await input.store.getKnowledge({ id });
        if (existing) {
          evidence.push(existing);
          continue;
        }
        const source = pending.get(sourceId)!;
        try {
          evidence.push(
            await input.store.appendKnowledge({
              id,
              node: node.id,
              text: `Procedure: ${value.procedure.trim()} Evidence source: ${source.id}.`,
              scope: source.scope,
              sourceThreadId: `subconscious:${input.parentThreadId}:learn`,
              maxScope: source.maxScope ?? input.maxScope,
              resolutionScope: input.scope,
              defaultScope: nodeScope,
            }),
          );
        } catch (error) {
          const raced = await input.store.getKnowledge({ id });
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
      const worklist = await readWorklist(store, context.parentThreadId, scope, cursor?.lastKnowledgeId);
      if (!worklist.records.length) return;
      const agent = await createLearnerAgent(
        memory,
        learnerMemory,
        context,
        scope,
        worklist.records,
        config,
        subconscious,
        options?.omModel,
      );
      const result = await agent.generate(
        `Parent thread: ${context.parentThreadId}\nCurrent time: ${new Date().toISOString()}\nWorklist truncated: ${worklist.hasMore}\n\nFull pre-reflection observations:\n${context.observations}\n\nPending knowledge records:\n${JSON.stringify(worklist.records)}`,
        {
          requestContext: context.requestContext,
          abortSignal: context.abortSignal,
          maxSteps: config.maxSteps,
          memory: { thread: `subconscious:${context.parentThreadId}:learn`, resource: context.resourceId },
        },
      );
      const acknowledgedId = result.text.match(/<learning-complete\s+through=["']([^"']+)["']\s*\/>/i)?.[1];
      if (!acknowledgedId || !worklist.records.some(record => record.id === acknowledgedId)) {
        throw new Error('Learner did not acknowledge a valid reviewed record cursor.');
      }
      await store.advanceCurationCursor({
        sourceThreadId: context.parentThreadId,
        agent: LEARN_AGENT,
        lastKnowledgeId: acknowledgedId,
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
  pendingRecords: KnowledgeRecord[],
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
        pendingRecords,
        parentThreadId: context.parentThreadId,
        defaultScope: subconscious.defaultScope,
        maxScope: subconscious.maxScope,
        state,
      }),
    },
  });
}

import type { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';

import type { Memory } from '../../src';
import { createCuratorHandler } from '../../src/processors/observational-memory/subconscious/curate';
import { resolveKnowledgeScopeIds } from '../../src/processors/observational-memory/subconscious/knowledge-tools';
import type { ResolvedSubconsciousConfig } from '../../src/processors/observational-memory/subconscious/types';
import type { ReconstructedCycle } from './reconstruct';

export type ReplayOutcome = {
  cycleIndex: number;
  sourceThreadId: string;
  outcome: 'ran' | 'no-op' | 'failed';
};

export type ReplayResult = {
  cyclesReplayed: number;
  curatorOutcomes: ReplayOutcome[];
  knowledgeNodes: number;
  knowledgeRecords: number;
  warnings: string[];
};

export type ReplayOptions = {
  cycles: ReconstructedCycle[];
  threadId: string;
  resourceId: string;
  organizationId: string;
  memory: Memory;
  curatorMemory?: Memory;
  subconscious: ResolvedSubconsciousConfig;
  mainAgent?: Agent;
  knowledgeResourceId?: string;
  onEvent?: (line: string) => void;
};

function requestContextWithOrg(organizationId: string, knowledgeResourceId?: string): RequestContext {
  if (!organizationId.trim()) throw new Error('Replay requires a non-empty organizationId.');
  const requestContext = new RequestContext();
  requestContext.set('organizationId', organizationId);
  if (knowledgeResourceId?.trim()) requestContext.set('knowledgeResourceId', knowledgeResourceId);
  return requestContext;
}

/**
 * Replay reconstructed, already-completed observation cycles through the same
 * curator agent and dispatch path used by the production Extractor. Observation
 * lifecycle ordering is covered by the strategy tests; this driver proves curation
 * quality through the real knowledge read/write boundary.
 */
export async function replayCycles(options: ReplayOptions): Promise<ReplayResult> {
  const store = await options.memory.getKnowledgeStore();
  if (!store) throw new Error('Replay requires a configured knowledge storage domain.');
  const config = options.subconscious.observation.find(agent => agent.name === 'curate');
  if (!config) throw new Error('Replay requires a Subconscious with a "curate" observation agent.');

  const requestContext = requestContextWithOrg(options.organizationId, options.knowledgeResourceId);
  const scopeIds = await resolveKnowledgeScopeIds(options.memory, {
    agent: { threadId: options.threadId, resourceId: options.resourceId },
    requestContext,
  });
  const handler = createCuratorHandler(
    options.memory,
    options.subconscious,
    options.curatorMemory ?? options.memory,
  );
  const curatorOutcomes: ReplayOutcome[] = [];
  const warnings: string[] = [];

  for (const [cycleIndex, cycle] of options.cycles.entries()) {
    try {
      if (!cycle.observations.trim()) {
        curatorOutcomes.push({ cycleIndex, sourceThreadId: options.threadId, outcome: 'no-op' });
        options.onEvent?.(`CURATOR cycle=${cycleIndex} thread=${options.threadId} outcome=no-op`);
        continue;
      }
      await handler({
        parentThreadId: options.threadId,
        resourceId: options.resourceId,
        observations: cycle.observations,
        requestContext,
        mainAgent: options.mainAgent,
      });
      curatorOutcomes.push({ cycleIndex, sourceThreadId: options.threadId, outcome: 'ran' });
      options.onEvent?.(`CURATOR cycle=${cycleIndex} thread=${options.threadId} outcome=ran`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      curatorOutcomes.push({ cycleIndex, sourceThreadId: options.threadId, outcome: 'failed' });
      warnings.push(`cycle ${cycleIndex}: curator failed (${message})`);
      options.onEvent?.(`CURATOR cycle=${cycleIndex} thread=${options.threadId} outcome=failed`);
    }
  }
  const nodes = (await store.listNodes({ scopeIds, limit: 1_000 })).filter(node => !node.isScope);
  const records = await Promise.all(nodes.map(node => store.listRecords({ node: node.id, scopeIds, limit: 1_000 })));
  const knowledgeRecords = records.reduce((total, page) => total + page.records.length, 0);

  return {
    cyclesReplayed: options.cycles.length,
    curatorOutcomes,
    knowledgeNodes: nodes.length,
    knowledgeRecords,
    warnings,
  };
}

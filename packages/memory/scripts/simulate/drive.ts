import type { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';

import type { Memory } from '../../src';
import { createObservationCuratorHandler } from '../../src/processors/observational-memory/subconscious/curate';
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
  worklistOperations: 0;
  cursorOperations: 0;
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
 * observation-time curator handler used by production. Observation lifecycle
 * ordering is covered by the strategy tests; this driver proves curation quality
 * through the real knowledge read/write boundary.
 */
export async function replayCycles(options: ReplayOptions): Promise<ReplayResult> {
  const store = await options.memory.storage.getStore('knowledge');
  if (!store) throw new Error('Replay requires a configured knowledge storage domain.');
  if (!options.subconscious.observation.some(agent => agent.name === 'curate')) {
    throw new Error('Replay requires a Subconscious with a "curate" observation agent.');
  }

  const curate = createObservationCuratorHandler(
    options.memory,
    options.subconscious,
    options.curatorMemory ?? options.memory,
  );
  const requestContext = requestContextWithOrg(options.organizationId, options.knowledgeResourceId);
  const curatorOutcomes: ReplayOutcome[] = [];
  const warnings: string[] = [];

  for (const [cycleIndex, cycle] of options.cycles.entries()) {
    try {
      const outcome = await curate({
        parentThreadId: options.threadId,
        resourceId: options.resourceId,
        observations: cycle.observations,
        requestContext,
        mainAgent: options.mainAgent,
      });
      curatorOutcomes.push({ cycleIndex, sourceThreadId: options.threadId, outcome });
      options.onEvent?.(`CURATOR cycle=${cycleIndex} thread=${options.threadId} outcome=${outcome}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      curatorOutcomes.push({ cycleIndex, sourceThreadId: options.threadId, outcome: 'failed' });
      warnings.push(`cycle ${cycleIndex}: curator failed (${message})`);
      options.onEvent?.(`CURATOR cycle=${cycleIndex} thread=${options.threadId} outcome=failed`);
    }
  }

  const scopeResourceId = options.knowledgeResourceId?.trim() || options.resourceId;
  const scope = [`org:${options.organizationId}`, `resource:${scopeResourceId}`, `thread:${options.threadId}`];
  const nodes = await store.listNodes({ scope, limit: 1_000 });
  const records = await Promise.all(
    nodes.map(node => store.listKnowledgeAbout({ node: node.id, scope, limit: 1_000 })),
  );
  const knowledgeRecords = records.reduce((total, page) => total + page.records.length, 0);

  return {
    cyclesReplayed: options.cycles.length,
    curatorOutcomes,
    knowledgeNodes: nodes.length,
    knowledgeRecords,
    worklistOperations: 0,
    cursorOperations: 0,
    warnings,
  };
}

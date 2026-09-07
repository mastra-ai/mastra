import type { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';

import type { Memory } from '../../src';
import {
  CURATION_AGENT,
  createCuratorAgent,
  dispatchCuratorObservation,
  resolveCuratorScope,
} from '../../src/processors/observational-memory/subconscious/curate';
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
  const store = await options.memory.storage.getStore('knowledge');
  if (!store) throw new Error('Replay requires a configured knowledge storage domain.');
  const config = options.subconscious.observation.find(agent => agent.name === CURATION_AGENT);
  if (!config) throw new Error(`Replay requires a Subconscious with a "${CURATION_AGENT}" observation agent.`);

  const requestContext = requestContextWithOrg(options.organizationId, options.knowledgeResourceId);
  const context = {
    threadId: options.threadId,
    resourceId: options.resourceId,
    requestContext,
    mainAgent: options.mainAgent,
  };
  const scope = resolveCuratorScope(context);
  const curatorOutcomes: ReplayOutcome[] = [];
  const warnings: string[] = [];

  for (const [cycleIndex, cycle] of options.cycles.entries()) {
    try {
      if (!cycle.observations.trim()) {
        curatorOutcomes.push({ cycleIndex, sourceThreadId: options.threadId, outcome: 'no-op' });
        options.onEvent?.(`CURATOR cycle=${cycleIndex} thread=${options.threadId} outcome=no-op`);
        continue;
      }
      const agent = await createCuratorAgent(
        options.memory,
        options.curatorMemory ?? options.memory,
        context,
        scope,
        config,
        options.subconscious,
      );
      const accepted = await dispatchCuratorObservation(agent, context, config, cycle.observations).accepted;
      if (accepted.action === 'wake') await accepted.output.consumeStream();
      curatorOutcomes.push({ cycleIndex, sourceThreadId: options.threadId, outcome: 'ran' });
      options.onEvent?.(`CURATOR cycle=${cycleIndex} thread=${options.threadId} outcome=ran`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      curatorOutcomes.push({ cycleIndex, sourceThreadId: options.threadId, outcome: 'failed' });
      warnings.push(`cycle ${cycleIndex}: curator failed (${message})`);
      options.onEvent?.(`CURATOR cycle=${cycleIndex} thread=${options.threadId} outcome=failed`);
    }
  }
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
    warnings,
  };
}

import type { PubSub } from '@mastra/core/events';
import type { Mastra } from '@mastra/core/mastra';
import type { WorkflowLeafFinal, WorkflowsStorage } from '@mastra/core/storage';
import type {
  ExecutionEngineOptions,
  OutputWriter,
  SerializedStepFlowEntry,
  StepFlowEntry,
  WorkflowStreamEvent,
} from '@mastra/core/workflows';
import type { Inngest } from 'inngest';
import type { LeafCandidate, LeafInvokeData, LeafRequest, LeafReturn } from './contracts';
import { injectLeafFault, LeafInfrastructureError, leafFunctionId } from './contracts';
import { executeLeaf } from './execute-leaf';

/** How many times Inngest retries a leaf whose machinery failed. The step's own failures never reach this. */
const LEAF_INFRA_RETRIES = 3;

export interface LeafFunctionDeps {
  workflowId: string;
  getMastra: () => Mastra | undefined;
  getGraph: () => { graph: StepFlowEntry[]; serializedStepGraph: SerializedStepFlowEntry[] };
  getOptions: () => ExecutionEngineOptions;
  createPubsub: () => PubSub;
}

async function leafStore(mastra: Mastra | undefined): Promise<WorkflowsStorage> {
  const store = await mastra?.getStorage()?.getStore('workflows');
  if (!store?.supportsLeafAdoption()) {
    throw new LeafInfrastructureError('Leaf execution needs a workflows store that supports leaf adoption');
  }
  return store;
}

/**
 * The synthetic Inngest function that runs a storage v2 workflow's steps one occurrence and attempt at a
 * time. Two sibling steps, never nested:
 *
 * - `execute-and-stage` runs the step against the request's pinned state and saves an immutable candidate.
 *   A retry after a lost ack runs the step again and saves another candidate; the earlier one is orphaned.
 * - `finalize-selected` records the candidate Inngest memoized as the leaf run's final one (first write
 *   wins), and returns its receipt.
 */
export function createLeafFunction(inngest: Inngest, deps: LeafFunctionDeps): ReturnType<Inngest['createFunction']> {
  return inngest.createFunction(
    {
      id: leafFunctionId(deps.workflowId),
      retries: LEAF_INFRA_RETRIES,
      triggers: { event: leafFunctionId(deps.workflowId) },
    },
    async ({ event, step }): Promise<LeafReturn> => {
      const data = event.data as LeafInvokeData;
      const { workflowId, runId, leafRunId } = data;

      const staged = await step.run('execute-and-stage', async () => {
        const mastra = deps.getMastra();
        const store = await leafStore(mastra);
        const request = await store.loadWorkflowLeafRecord<LeafRequest>({
          workflowName: workflowId,
          runId,
          kind: 'request',
          key: leafRunId,
        });
        if (!request) {
          throw new LeafInfrastructureError(`Leaf request ${leafRunId} of ${workflowId}/${runId} is not stored`);
        }

        const pubsub = deps.createPubsub();
        const outputWriter: OutputWriter = async (chunk: WorkflowStreamEvent) => {
          try {
            await pubsub.publish(`workflow.events.v2.${runId}`, { type: 'watch', runId, data: chunk });
          } catch {
            // Writer chunks are best-effort, as in the parent run.
          }
        };
        const { graph, serializedStepGraph } = deps.getGraph();
        const { outcome, statePatch } = await executeLeaf({
          mastra,
          store,
          options: deps.getOptions(),
          graph,
          serializedStepGraph,
          request,
          pubsub,
          outputWriter,
          actor: data.actor,
        });

        const candidateId = `${leafRunId}#${globalThis.crypto.randomUUID()}`;
        const candidate: LeafCandidate = { v: 1, candidateId, leafRunId, statePatch, outcome };
        await store.putWorkflowLeafRecord({
          workflowName: workflowId,
          runId,
          kind: 'candidate',
          key: candidateId,
          payload: candidate,
        });
        injectLeafFault('candidate-staged', { leafRunId });
        return { candidateId };
      });

      return step.run('finalize-selected', async () => {
        const store = await leafStore(deps.getMastra());
        const { payload: final } = await store.putWorkflowLeafRecord<WorkflowLeafFinal>({
          workflowName: workflowId,
          runId,
          kind: 'final',
          key: leafRunId,
          payload: { v: 1, leafRunId, candidateId: staged.candidateId },
        });
        const candidate = await store.loadWorkflowLeafRecord<LeafCandidate>({
          workflowName: workflowId,
          runId,
          kind: 'candidate',
          key: final.candidateId,
        });
        if (!candidate) {
          throw new LeafInfrastructureError(
            `Leaf candidate ${final.candidateId} of ${workflowId}/${runId} is not stored`,
          );
        }
        injectLeafFault('final-written', { leafRunId });
        return { v: 1 as const, leafRunId, candidateId: final.candidateId, status: candidate.outcome.status };
      });
    },
  );
}

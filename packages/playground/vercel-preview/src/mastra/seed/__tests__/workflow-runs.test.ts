import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { workflowReviewAgent } from '../../agents/workflow-review-agent';
import { previewWorkflows } from '../../workflows';
import { orderInputSchema } from '../../workflows/order-fulfillment/schemas';
import { seedPreviewWorkflowRuns } from '../workflow-runs';
import { workflowNodeCoverage } from './fixtures/workflow-node-coverage';

const storage = new InMemoryStore();
const workflowsStore = await storage.getStore('workflows');
const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Preview seeds must not use the network.'));

function collectGraphEntries(entries: SerializedStepFlowEntry[]): SerializedStepFlowEntry[] {
  return entries.flatMap(entry => {
    switch (entry.type) {
      case 'parallel':
      case 'conditional':
        return [entry, ...collectGraphEntries(entry.steps)];
      case 'foreach':
      case 'loop':
        return [entry, ...collectGraphEntries([entry.step])];
      case 'workflow':
        return [entry, ...collectGraphEntries(entry.serializedStepFlow ?? [])];
      case 'step':
        return [entry, ...collectGraphEntries(entry.step.serializedStepFlow ?? [])];
      default:
        return [entry];
    }
  });
}

beforeAll(async () => {
  new Mastra({ logger: false, storage, workflows: previewWorkflows, agents: { workflowReviewAgent } });
  await seedPreviewWorkflowRuns();
});

afterAll(() => fetchSpy.mockRestore());

describe('preview workflow history', () => {
  describe('when startup seeding finishes', () => {
    it.each([
      ['request-review', 'preview-request-automatic', 'success'],
      ['request-review', 'preview-request-awaiting-review', 'suspended'],
      ['request-review', 'preview-request-approved', 'success'],
      ['request-review', 'preview-request-declined', 'failed'],
      ['document-batch', 'preview-document-batch', 'success'],
      ['countdown', 'preview-countdown', 'success'],
      ['order-fulfillment', 'preview-order-completed', 'success'],
      ['order-fulfillment', 'preview-order-awaiting-approval', 'suspended'],
      ['order-fulfillment', 'preview-order-approved', 'success'],
      ['order-fulfillment', 'preview-order-rejected', 'failed'],
      ['order-fulfillment', 'preview-order-dispatch-failed', 'failed'],
      ['order-fulfillment', 'preview-order-canceled', 'canceled'],
      ['order-fulfillment', 'preview-order-debug-paused', 'paused'],
      ['collection-processing', 'preview-collection-empty', 'success'],
      ['collection-processing', 'preview-collection-single', 'success'],
      ['collection-processing', 'preview-collection-repeated', 'success'],
      ['collection-processing', 'preview-collection-failed-item', 'failed'],
      ['delivery-routing', 'preview-delivery-all', 'success'],
      ['delivery-routing', 'preview-delivery-one', 'success'],
      ['delivery-routing', 'preview-delivery-none', 'success'],
      ['retry-window', 'preview-retry-completed', 'success'],
      ['retry-window', 'preview-retry-zero-delay', 'success'],
      ['retry-window', 'preview-retry-bailed', 'success'],
      ['agent-review', 'preview-agent-tripwire', 'tripwire'],
      ['delayed-report', 'preview-delayed-report', 'success'],
    ])('persists %s / %s with status %s', async (workflowName, runId, status) => {
      const snapshot = await workflowsStore?.loadWorkflowSnapshot({ workflowName, runId });
      expect(snapshot?.status).toBe(status);
    });

    it('makes no model or external API calls', () => {
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it.each(Object.entries(workflowNodeCoverage))('exposes %s in %s', (kind, workflowName) => {
      const entries = collectGraphEntries(previewWorkflows[workflowName].serializedStepGraph);
      expect(entries.map(entry => entry.type)).toContain(kind);
    });

    it('covers both loop conditions', () => {
      const entries = Object.values(previewWorkflows).flatMap(workflow =>
        collectGraphEntries(workflow.serializedStepGraph),
      );
      expect(entries.filter(entry => entry.type === 'loop').map(entry => entry.loopType)).toEqual(
        expect.arrayContaining(['dowhile', 'dountil']),
      );
    });

    it('preserves falsy values and empty data in tool output', async () => {
      const snapshot = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: 'collection-processing',
        runId: 'preview-collection-empty',
      });
      expect(snapshot?.result).toEqual({
        processed: 0,
        items: [],
        optionalNote: null,
        hasWarnings: false,
        warningCount: 0,
        warnings: [],
      });
    });

    it('keeps duplicate and Unicode items as separate results', async () => {
      const snapshot = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: 'collection-processing',
        runId: 'preview-collection-repeated',
      });
      expect(snapshot?.result?.items).toEqual([
        { value: 'Repeated item', index: 0 },
        { value: 'Repeated item', index: 1 },
        { value: 'Café · 日本語', index: 2 },
      ]);
    });

    it('retains successful iterations before a failed item', async () => {
      const snapshot = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: 'collection-processing',
        runId: 'preview-collection-failed-item',
      });
      expect(snapshot?.context['process-collection-item'].suspendPayload?.__workflow_meta?.foreachOutput).toEqual([
        expect.objectContaining({ status: 'success', output: { value: 'Repeated item', index: 0 } }),
        expect.objectContaining({ status: 'failed' }),
      ]);
    });

    it.each([
      ['preview-delivery-all', ['email', 'sms', 'audit']],
      ['preview-delivery-one', ['email']],
      ['preview-delivery-none', []],
    ])('stores only the chosen paths for %s', async (runId, channels) => {
      const snapshot = await workflowsStore?.loadWorkflowSnapshot({ workflowName: 'delivery-routing', runId });
      expect(snapshot?.result?.deliveries).toEqual(
        channels.map(channel => ({ channel, message: 'A local delivery preview. No message is sent.' })),
      );
    });

    it('preserves overlapping parallel timings', async () => {
      const snapshot = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: 'order-fulfillment',
        runId: 'preview-order-completed',
      });
      const inventory = snapshot?.context['check-inventory'];
      const risk = snapshot?.context['assess-risk'];
      if (inventory?.status !== 'success' || risk?.status !== 'success') {
        throw new Error('Expected two completed parallel checks.');
      }
      expect(inventory.startedAt).toBeLessThan(risk.endedAt);
      expect(risk.startedAt).toBeLessThan(inventory.endedAt);
      expect(snapshot?.result?.packages).toHaveLength(3);
    });

    it('leaves later steps unstarted when the run bails out', async () => {
      const snapshot = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: 'retry-window',
        runId: 'preview-retry-bailed',
      });
      expect(snapshot?.context['check-readiness']).toBeUndefined();
      expect(snapshot?.result).toEqual({ attempts: 0, message: 'Stopped before retrying.' });
    });

    it('keeps a live review decision when seeding is requested again', async () => {
      const run = await previewWorkflows.orderFulfillment.createRun({ runId: 'preview-order-awaiting-approval' });
      await run.resume({ step: 'request-approval', resumeData: { approved: false } });
      const rejected = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: 'order-fulfillment',
        runId: run.runId,
      });
      await seedPreviewWorkflowRuns();
      expect(
        await workflowsStore?.loadWorkflowSnapshot({ workflowName: 'order-fulfillment', runId: run.runId }),
      ).toEqual(rejected);
    });
  });

  describe('when resuming without an approval decision', () => {
    it('rejects the request before packing starts', async () => {
      const run = await previewWorkflows.orderFulfillment.createRun();
      await run.start({ inputData: orderInputSchema.parse({}) });
      await expect(run.resume({ step: 'request-approval', resumeData: {} })).rejects.toThrow(/approved/);
      const snapshot = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: 'order-fulfillment',
        runId: run.runId,
      });
      expect(snapshot?.context['pack-order']).toBeUndefined();
    });
  });

  describe('when the failure index points outside the collection', () => {
    it('rejects the input instead of silently skipping the requested failure', async () => {
      const run = await previewWorkflows.collectionProcessing.createRun();
      await expect(run.start({ inputData: { items: [], failAt: 0 } })).rejects.toThrow(/existing item/);
    });
  });
});

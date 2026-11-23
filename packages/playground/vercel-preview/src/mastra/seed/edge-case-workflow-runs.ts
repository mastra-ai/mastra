import type { WorkflowRunStatus } from '@mastra/core/workflows';
import type { z } from 'zod/v4';
import { previewWorkflows } from '../workflows';
import { collectionInputSchema } from '../workflows/edge-cases/collection-processing';
import { deliveryInputSchema } from '../workflows/edge-cases/delivery-routing';
import { retryWindowInputSchema } from '../workflows/edge-cases/retry-window';
import { verifySeedRunStatus } from './seed-run-status';

async function seedCollectionRun(
  runId: string,
  input: z.input<typeof collectionInputSchema>,
  expected: WorkflowRunStatus = 'success',
): Promise<void> {
  const run = await previewWorkflows.collectionProcessing.createRun({ runId });
  const result = await run.start({ inputData: collectionInputSchema.parse(input) });
  verifySeedRunStatus(runId, result.status, expected);
}

async function seedDeliveryRun(runId: string, channel: z.infer<typeof deliveryInputSchema>['channel']): Promise<void> {
  const run = await previewWorkflows.deliveryRouting.createRun({ runId });
  const result = await run.start({ inputData: deliveryInputSchema.parse({ channel }) });
  verifySeedRunStatus(runId, result.status, 'success');
}

async function seedRetryRun(runId: string, input: z.input<typeof retryWindowInputSchema>): Promise<void> {
  const run = await previewWorkflows.retryWindow.createRun({ runId });
  const result = await run.start({ inputData: retryWindowInputSchema.parse(input) });
  verifySeedRunStatus(runId, result.status, 'success');
}

async function seedAgentTripwire(): Promise<void> {
  const run = await previewWorkflows.agentReview.createRun({ runId: 'preview-agent-tripwire' });
  const result = await run.start({ inputData: { prompt: 'preview-tripwire' } });
  verifySeedRunStatus(run.runId, result.status, 'tripwire');
}

async function seedDelayedReport(): Promise<void> {
  const run = await previewWorkflows.delayedReport.createRun({ runId: 'preview-delayed-report' });
  const result = await run.start({ inputData: { message: 'The report is ready.' } });
  verifySeedRunStatus(run.runId, result.status, 'success');
}

export async function seedEdgeCaseWorkflowRuns(): Promise<void> {
  await Promise.all([
    seedCollectionRun('preview-collection-empty', { items: [] }),
    seedCollectionRun('preview-collection-single', { items: ['Only item'] }),
    seedCollectionRun('preview-collection-repeated', {}),
    seedCollectionRun('preview-collection-failed-item', { failAt: 1 }, 'failed'),
    seedDeliveryRun('preview-delivery-all', 'all'),
    seedDeliveryRun('preview-delivery-one', 'email'),
    seedDeliveryRun('preview-delivery-none', 'none'),
    seedRetryRun('preview-retry-completed', {}),
    seedRetryRun('preview-retry-zero-delay', { delayMs: 0, readyAfter: 1 }),
    seedRetryRun('preview-retry-bailed', { stopEarly: true }),
    seedAgentTripwire(),
    seedDelayedReport(),
  ]);
}

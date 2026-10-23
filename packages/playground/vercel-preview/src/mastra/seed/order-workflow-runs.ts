import type { WorkflowRunStatus } from '@mastra/core/workflows';
import type { z } from 'zod/v4';
import { orderFulfillment } from '../workflows/order-fulfillment';
import { orderInputSchema } from '../workflows/order-fulfillment/schemas';
import { verifySeedRunStatus } from './seed-run-status';

async function seedOrderRun(
  runId: string,
  input: z.input<typeof orderInputSchema>,
  expected: WorkflowRunStatus,
  approved?: boolean,
): Promise<void> {
  const run = await orderFulfillment.createRun({ runId });
  let result = await run.start({ inputData: orderInputSchema.parse(input) });
  if (approved !== undefined) {
    verifySeedRunStatus(runId, result.status, 'suspended');
    result = await run.resume({ step: 'request-approval', resumeData: { approved } });
  }
  verifySeedRunStatus(runId, result.status, expected);
}

async function seedPausedOrder(): Promise<void> {
  const run = await orderFulfillment.createRun({ runId: 'preview-order-debug-paused' });
  const execution = run.stream({ inputData: orderInputSchema.parse({ approval: 'automatic' }), perStep: true });
  await execution.fullStream.pipeTo(new WritableStream());
  verifySeedRunStatus(run.runId, (await execution.result).status, 'paused');
}

async function seedCanceledOrder(): Promise<void> {
  const run = await orderFulfillment.createRun({ runId: 'preview-order-canceled' });
  const execution = run.stream({ inputData: orderInputSchema.parse({ approval: 'automatic' }) });
  for await (const event of execution.fullStream) {
    if (event.type === 'workflow-step-start') await run.cancel();
  }
  verifySeedRunStatus(run.runId, (await execution.result).status, 'canceled');
}

export async function seedOrderWorkflowRuns(): Promise<void> {
  await Promise.all([
    seedOrderRun('preview-order-completed', { approval: 'automatic' }, 'success'),
    seedOrderRun('preview-order-awaiting-approval', {}, 'suspended'),
    seedOrderRun('preview-order-approved', {}, 'success', true),
    seedOrderRun('preview-order-rejected', {}, 'failed', false),
    seedOrderRun('preview-order-dispatch-failed', { approval: 'automatic', failDispatch: true }, 'failed'),
    seedPausedOrder(),
    seedCanceledOrder(),
  ]);
}

import { previewWorkflows } from '../workflows';
import { countdownInputSchema } from '../workflows/countdown';
import { documentBatchInputSchema } from '../workflows/document-batch';

let seedPromise: Promise<void> | undefined;

export function seedPreviewWorkflowRuns(): Promise<void> {
  seedPromise ??= seedWorkflowRuns();
  return seedPromise;
}

async function seedWorkflowRuns(): Promise<void> {
  const { requestReview, documentBatch, countdown } = previewWorkflows;
  const automaticallyApprovedRun = await requestReview.createRun({ runId: 'preview-request-automatic' });
  await automaticallyApprovedRun.start({ inputData: { title: 'Office supplies', amount: 180 } });

  const pendingReviewRun = await requestReview.createRun({ runId: 'preview-request-awaiting-review' });
  await pendingReviewRun.start({ inputData: { title: 'Team workshop', amount: 2400 } });

  const manuallyApprovedRun = await requestReview.createRun({ runId: 'preview-request-approved' });
  await manuallyApprovedRun.start({ inputData: { title: 'Research equipment', amount: 1600 } });
  await manuallyApprovedRun.resume({ step: 'review-request', resumeData: { approved: true } });

  const declinedRun = await requestReview.createRun({ runId: 'preview-request-declined' });
  await declinedRun.start({ inputData: { title: 'Conference travel', amount: 3200 } });
  await declinedRun.resume({ step: 'review-request', resumeData: { approved: false } });

  const batchRun = await documentBatch.createRun({ runId: 'preview-document-batch' });
  await batchRun.start({ inputData: documentBatchInputSchema.parse({}) });

  const countdownRun = await countdown.createRun({ runId: 'preview-countdown' });
  await countdownRun.start({ inputData: countdownInputSchema.parse({}) });
}

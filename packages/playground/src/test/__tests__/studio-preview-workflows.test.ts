// @vitest-environment node
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { beforeAll, describe, expect, it } from 'vitest';
import { seedPreviewWorkflowRuns } from '../../../vercel-preview/src/mastra/seed/workflow-runs';
import { previewWorkflows } from '../../../vercel-preview/src/mastra/workflows';

describe('Studio preview workflows', () => {
  const mastra = new Mastra({ workflows: previewWorkflows, storage: new InMemoryStore(), logger: false });

  beforeAll(async () => {
    await seedPreviewWorkflowRuns();
  });

  describe('when the preview starts', () => {
    it('provides completed, suspended, and failed approval runs with step data', async () => {
      const workflow = mastra.getWorkflow('requestReview');
      const { runs } = await workflow.listWorkflowRuns();

      const seededRuns = await Promise.all(
        runs.filter(run => run.runId.startsWith('preview-')).map(run => workflow.getWorkflowRunById(run.runId)),
      );
      expect(seededRuns.map(run => run?.status).sort()).toEqual(['failed', 'success', 'success', 'suspended']);
      const suspended = await workflow.getWorkflowRunById('preview-request-awaiting-review');
      expect(suspended?.steps?.['review-request']).toMatchObject({
        status: 'suspended',
        suspendPayload: { title: 'Team workshop', amount: 2400 },
      });
    });

    it('keeps nested batch results available to the run inspector', async () => {
      const run = await mastra.getWorkflow('documentBatch').getWorkflowRunById('preview-document-batch', {
        withNestedWorkflows: true,
      });

      expect(run?.status).toBe('success');
      expect(run?.result).toMatchObject({ processed: 3 });
      expect(run?.steps?.['analyze-document[0].count-words']).toMatchObject({ status: 'success' });
    });

    it('finishes the loop at zero', async () => {
      const run = await mastra.getWorkflow('countdown').getWorkflowRunById('preview-countdown');

      expect(run?.status).toBe('success');
      expect(run?.result).toEqual({ remaining: 0 });
    });
  });

  describe('when a reviewer resumes a new request', () => {
    it('completes the request with the review decision', async () => {
      const workflow = mastra.getWorkflow('requestReview');
      const run = await workflow.createRun();
      await run.start({ inputData: { title: 'Team workshop', amount: 2400 } });
      const result = await run.resume({ step: 'review-request', resumeData: { approved: true } });

      expect(result).toMatchObject({ status: 'success', result: { title: 'Team workshop', approvedBy: 'Reviewer' } });
    });
  });

  describe('when startup seeding is requested again', () => {
    it('preserves existing runs and review decisions', async () => {
      const workflow = mastra.getWorkflow('requestReview');
      const beforeSeeding = await workflow.listWorkflowRuns();

      await Promise.all([seedPreviewWorkflowRuns(), seedPreviewWorkflowRuns()]);

      expect(await workflow.listWorkflowRuns()).toEqual(beforeSeeding);
    });
  });
});

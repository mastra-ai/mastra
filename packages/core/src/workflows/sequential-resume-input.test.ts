import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createStep, createWorkflow } from './workflow';

describe('workflow resume: sequential step input preservation', () => {
  it('keeps strict step input intact across suspend -> resume -> suspend -> resume', async () => {
    const storage = new MockStore();
    const sourceOutputSchema = z.object({
      query: z.string(),
      searchPlan: z.object({
        queries: z.array(z.string()).min(1),
        extractionGoals: z.array(z.string()).min(1),
      }),
      papers: z
        .array(
          z.object({
            id: z.string(),
            title: z.string(),
            abstract: z.string(),
          }),
        )
        .min(1),
      budget: z.number(),
    });
    const reviewResumeSchema = z.object({
      action: z.enum(['revise', 'approve']),
      note: z.string(),
    });

    const produceLiterature = createStep({
      id: 'produce-literature',
      inputSchema: z.object({ topic: z.string() }),
      outputSchema: sourceOutputSchema,
      execute: async ({ inputData }) => ({
        query: inputData.topic,
        searchPlan: {
          queries: [`${inputData.topic} benchmark`],
          extractionGoals: ['quality', 'latency'],
        },
        papers: [
          {
            id: 'paper-1',
            title: 'Benchmark Paper',
            abstract: 'A useful abstract for the extraction schema step.',
          },
        ],
        budget: 3,
      }),
    });

    const observedInputs: Array<z.infer<typeof sourceOutputSchema>> = [];
    const executeReview = vi.fn(async ({ inputData, resumeData, suspend }) => {
      observedInputs.push(inputData);

      if (!resumeData) {
        await suspend({
          prompt: 'Review generated schema',
          seenQuery: inputData.query,
        });
      }

      if (resumeData?.action === 'revise') {
        await suspend({
          prompt: 'Review revised schema',
          seenQuery: inputData.query,
        });
      }

      return {
        ...inputData,
        approved: true,
        revisionNotes: resumeData ? [resumeData.note] : [],
      };
    });
    const reviewSchema = createStep({
      id: 'review-schema',
      inputSchema: sourceOutputSchema,
      outputSchema: sourceOutputSchema.extend({
        approved: z.boolean(),
        revisionNotes: z.array(z.string()),
      }),
      suspendSchema: z.object({
        prompt: z.string(),
        seenQuery: z.string(),
      }),
      resumeSchema: reviewResumeSchema,
      execute: executeReview,
    });

    const workflow = createWorkflow({
      id: 'sequential-second-resume-input-preservation',
      inputSchema: z.object({ topic: z.string() }),
      outputSchema: sourceOutputSchema.extend({
        approved: z.boolean(),
        revisionNotes: z.array(z.string()),
      }),
      steps: [produceLiterature, reviewSchema],
    })
      .then(produceLiterature)
      .then(reviewSchema)
      .commit();

    new Mastra({
      logger: false,
      storage,
      workflows: { 'sequential-second-resume-input-preservation': workflow },
    });

    const run = await workflow.createRun();
    const started = await run.start({ inputData: { topic: 'workflow resume' } });
    expect(started.status).toBe('suspended');

    const afterRevision = await run.resume({
      resumeData: { action: 'revise', note: 'add latency fields' },
    });
    expect(afterRevision.status).toBe('suspended');

    const completed = await run.resume({
      resumeData: { action: 'approve', note: 'looks good' },
    });
    expect(completed.status).toBe('success');
    if (completed.status === 'success') {
      expect(completed.result).toMatchObject({
        query: 'workflow resume',
        approved: true,
        revisionNotes: ['looks good'],
      });
    }

    expect(executeReview).toHaveBeenCalledTimes(3);
    expect(observedInputs).toHaveLength(3);
    for (const input of observedInputs) {
      expect(input).toEqual({
        query: 'workflow resume',
        searchPlan: {
          queries: ['workflow resume benchmark'],
          extractionGoals: ['quality', 'latency'],
        },
        papers: [
          {
            id: 'paper-1',
            title: 'Benchmark Paper',
            abstract: 'A useful abstract for the extraction schema step.',
          },
        ],
        budget: 3,
      });
    }
  });
});

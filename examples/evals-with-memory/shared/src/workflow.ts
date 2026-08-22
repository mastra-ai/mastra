/**
 * A two-step workflow, so the workshop can show that evals are not an
 * agent-only feature.
 *
 * `runEvals` accepts a Workflow target, and workflow scorers aim at three
 * different levels:
 *
 *   workflow    the overall input → output
 *   steps       an individual step, addressed by its id
 *   trajectory  the sequence of steps that actually executed
 *
 * Step-level scoring is the one people do not expect. When a workflow produces
 * a bad answer, it tells you *which* step degraded rather than only that the
 * whole thing got worse.
 */
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { NIMBUS_KNOWLEDGE } from './data/support-qa.ts';

/** Step 1 — decide which topic the question belongs to. */
const triageStep = createStep({
  id: 'triage',
  description: 'Classify the incoming question into a support topic',
  inputSchema: z.object({ question: z.string() }),
  outputSchema: z.object({ question: z.string(), topic: z.string() }),
  execute: async ({ inputData }) => {
    const q = inputData.question.toLowerCase();
    const topic =
      Object.keys(NIMBUS_KNOWLEDGE).find(key => q.includes(key.toLowerCase())) ??
      (q.includes('storage') || q.includes('plan')
        ? 'free plan'
        : q.includes('delete') || q.includes('restore')
          ? 'deleted files'
          : q.includes('refund') || q.includes('money')
            ? 'refund'
            : 'unknown');
    return { question: inputData.question, topic };
  },
});

/** Step 2 — answer from the knowledge base for that topic. */
const answerStep = createStep({
  id: 'answer',
  description: 'Answer the question using the knowledge base entry for the topic',
  inputSchema: z.object({ question: z.string(), topic: z.string() }),
  outputSchema: z.object({ answer: z.string(), topic: z.string() }),
  execute: async ({ inputData }) => {
    const answer =
      NIMBUS_KNOWLEDGE[inputData.topic] ??
      `I don't have information about that. Question was: ${inputData.question}`;
    return { answer, topic: inputData.topic };
  },
});

export const supportWorkflow = createWorkflow({
  id: 'support-workflow',
  description: 'Triage a Nimbus support question, then answer it',
  inputSchema: z.object({ question: z.string() }),
  outputSchema: z.object({ answer: z.string(), topic: z.string() }),
})
  .then(triageStep)
  .then(answerStep)
  .commit();

import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { workflowAgentDemoBranchBrief, workflowAgentDemoBranchVerbose, workflowAgentDemoForeachAgent } from '../agents';

/**
 * Kitchen-sink workflow for workflow-scoped agent transcripts:
 * - **foreach** over fixed rounds — each iteration is `createStep(agent)` (not plain steps).
 * - **branch** — brief vs verbose follow-up agent from combined foreach output.
 *
 * Distinct from `weatherAgent`'s attached `lessComplexWorkflow`: that workflow powers the agent chat / older E2E tests only.
 *
 * Run with input `{ "prompt": "What is the weather in Paris?" }`.
 */

const normalizePromptStep = createStep({
  id: 'workflow-agent-demo-normalize',
  inputSchema: z.object({
    prompt: z.string(),
  }),
  outputSchema: z.object({
    prompt: z.string(),
  }),
  execute: async ({ inputData }) => ({
    prompt: inputData.prompt.trim(),
  }),
});

/** Emits one prompt per foreach iteration — each round invokes the foreach demo agent. */
const expandForeachRoundsStep = createStep({
  id: 'workflow-agent-demo-expand-foreach',
  inputSchema: z.object({
    prompt: z.string(),
  }),
  outputSchema: z.array(
    z.object({
      prompt: z.string(),
    }),
  ),
  execute: async ({ inputData }) => [
    { prompt: `${inputData.prompt} — pass 1: say which location you will use.` },
    { prompt: `${inputData.prompt} — pass 2: add one concrete condition (wind, rain, or temp).` },
  ],
});

const foreachAgentStep = createStep(workflowAgentDemoForeachAgent);

const branchBriefStep = createStep(workflowAgentDemoBranchBrief);
const branchVerboseStep = createStep(workflowAgentDemoBranchVerbose);

export const workflowAgentDemoWorkflow = createWorkflow({
  id: 'workflow-agent-demo',
  inputSchema: z.object({
    prompt: z
      .string()
      .describe('Runs multiple embedded agent passes (foreach), then a brief or verbose branch from the combined text'),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
})
  .then(normalizePromptStep)
  .then(expandForeachRoundsStep)
  .foreach(foreachAgentStep)
  .map(async ({ inputData }) => {
    const rounds = inputData as unknown as Array<{ text: string }>;
    return {
      prompt: rounds.map(r => r.text).join('\n\n---\n\n'),
    };
  })
  .branch([
    [async ({ inputData }) => inputData.prompt.length < 400, branchBriefStep],
    [async () => true, branchVerboseStep],
  ])
  .map(async ({ inputData }) => {
    const brief = inputData['workflow-agent-demo-brief'] as { text: string } | undefined;
    const verbose = inputData['workflow-agent-demo-verbose'] as { text: string } | undefined;
    const out = brief ?? verbose;
    if (!out) {
      throw new Error('branch produced no agent output');
    }
    return { text: out.text };
  })
  .commit();

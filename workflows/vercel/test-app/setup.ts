// Separate file for Mastra setup - not analyzed by workflow SDK
import { z } from 'zod';
import { Mastra } from '@mastra/core/mastra';
import { createStep } from '@mastra/core/workflows';
import { registerMastra, hasMastra } from '../src/singleton';
import { VercelWorkflow } from '../src/workflow';

export function ensureMastraSetup() {
  if (hasMastra()) return;

  const step1 = createStep({
    id: 'step1',
    execute: async ({ inputData }) => {
      console.log('[step1] Executing with input:', inputData);
      return { value: 'step1-output' };
    },
    inputSchema: z.object({}),
    outputSchema: z.object({ value: z.string() }),
  });

  const step2 = createStep({
    id: 'step2',
    execute: async ({ inputData }) => {
      console.log('[step2] Executing with input:', inputData);
      return { value: `step2-received-${(inputData as any).value}` };
    },
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
  });

  const workflow = new VercelWorkflow({
    id: 'test-workflow',
    inputSchema: z.object({}),
    outputSchema: z.object({ value: z.string() }),
  });

  workflow.then(step1).then(step2).commit();

  const mastra = new Mastra({
    workflows: { 'test-workflow': workflow },
  });

  registerMastra(mastra);
  workflow.__registerMastra(mastra);

  console.log('[setup] Mastra registered with test-workflow');
}

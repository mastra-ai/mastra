import { Mastra } from '@mastra/core/mastra';
import { DefaultStorage } from '@mastra/libsql';
import { Inngest } from 'inngest';
import { $ } from 'execa';
import { z } from 'zod';

import { init } from '../../index';
import type { InngestWorkflow } from '../../workflow';

export const INNGEST_PORT = 4000;
export const HANDLER_PORT = 4001;

export function createTestInngest(id: string) {
  return new Inngest({
    id,
    baseUrl: `http://localhost:${INNGEST_PORT}`,
  });
}

export async function resetInngest() {
  await new Promise(resolve => setTimeout(resolve, 1000));
  await $`docker-compose restart`;
  await new Promise(resolve => setTimeout(resolve, 1500));
}

export async function waitForInngestSync(ms = 2000) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

export interface TestWorkflowResult {
  workflow: InngestWorkflow<any, any, any>;
  mastra: Mastra;
  inngest: Inngest;
}

export function createTestWorkflow(adapterId: string): TestWorkflowResult {
  const inngest = createTestInngest(`test-${adapterId}`);
  const { createWorkflow, createStep } = init(inngest);

  const step1 = createStep({
    id: 'step1',
    execute: async ({ inputData }) => ({
      value: `${inputData.input}-step1`,
    }),
    inputSchema: z.object({ input: z.string() }),
    outputSchema: z.object({ value: z.string() }),
  });

  const step2 = createStep({
    id: 'step2',
    execute: async ({ inputData }) => ({
      result: `${inputData.value}-step2`,
    }),
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ result: z.string() }),
  });

  const workflow = createWorkflow({
    id: `${adapterId}-test-workflow`,
    inputSchema: z.object({ input: z.string() }),
    outputSchema: z.object({ result: z.string() }),
    steps: [step1, step2],
  });

  workflow.then(step1).then(step2).commit();

  const mastra = new Mastra({
    storage: new DefaultStorage({
      id: `test-storage-${adapterId}`,
      url: ':memory:',
    }),
    workflows: {
      [`${adapterId}-test-workflow`]: workflow,
    },
  });

  return { workflow, mastra, inngest };
}

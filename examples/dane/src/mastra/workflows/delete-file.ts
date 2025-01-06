import { Step, Workflow } from '@mastra/core';
import { z } from 'zod';

export const deleteFileWorkflow = new Workflow({
  name: 'delete-file',
  triggerSchema: z.object({
    file: z.string(),
  }),
});

const checkFileStep = new Step({
  id: 'newFile',
  description: 'Checks if the file exists',
  inputSchema: z.object({
    file: z.string(),
  }),
  execute: async ({ context }) => {
    const file = context.machineContext?.triggerData.file;
    console.log(file);
  },
});

deleteFileWorkflow.step(checkFileStep).commit();

import { input } from '@inquirer/prompts';
import { Step, Workflow } from '@mastra/core';
import { z } from 'zod';

export const deleteFileWorkflow = new Workflow({
  name: 'delete-file',
});

const receiveFileStep = new Step({
  id: 'receiveFile',
  description: 'Ask user for file.',
  outputSchema: z.object({
    file: z.string(),
  }),
  execute: async () => {
    const content = await input({
      message: 'Give me the file path :)',
      validate: input => input.trim().length > 0 || 'Message cannot be empty',
    });

    return {
      file: content,
    };
  },
});

const checkFileStep = new Step({
  id: 'newFile',
  description: 'Checks if the file exists',
  outputSchema: z.object({
    file: z.string(),
  }),
  execute: async ({ context }) => {
    if (context.machineContext?.stepResults.receiveFile?.status !== 'success') {
      throw new Error('File not found');
    }

    const file = context.machineContext.stepResults.receiveFile.payload.file;

    return {
      file,
    };
  },
});

const deletionStep = new Step({
  id: 'deletion',
  description: 'Delete file',
  outputSchema: z.object({
    deleted: z.boolean(),
  }),
  execute: async ({ suspend, context }) => {
    console.log('STEP STATUS', context?.machineContext?.stepResults.deletion);
    if (context?.machineContext?.stepResults.deletion?.status === 'success') {
      return { deleted: true };
    }
    await suspend();
    return { deleted: false };
  },
});

deleteFileWorkflow
  // .step(receiveFileStep)
  // .then(
  //     checkFileStep
  // )
  .step(deletionStep)
  .commit();

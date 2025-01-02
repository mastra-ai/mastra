import { Step, Workflow } from '@mastra/core';
import { z } from 'zod';

const askForPermissionStep = new Step({
  id: 'askForPermission',
  inputSchema: z.object({
    target: z.string(),
  }),
  outputSchema: z.object({
    questionId: z.string(),
  }),
  execute: async ({ context }) => {
    const { target } = context;
    const response = await fetch('http://localhost:3000/questions', {
      method: 'POST',
      body: JSON.stringify({
        text: `Permission to attack ${target}?`,
      }),
    });
    const data = (await response.json()) as { id: string };
    return { questionId: data.id };
  },
});

const attackStep = new Step({
  id: 'attack',
  inputSchema: z.object({
    target: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  execute: async ({ context }) => {
    const { target } = context;
    console.log(`🚀 Launching attack on ${target}!`);
    return { success: true };
  },
});

export const attackWorkflow = new Workflow({
  name: 'attack',
  triggerSchema: z.object({
    target: z.string(),
  }),
  retryConfig: {
    attempts: 3,
    delay: 2000,
  },
});

attackWorkflow
  .step(askForPermissionStep)
  .then(attackStep, {
    when: async ({ context }) => {
      if (context.stepResults.askForPermission?.status !== 'success') {
        return false;
      }
      const { questionId } = context.stepResults.askForPermission.payload;
      const response = await fetch(`http://localhost:3000/questions/${questionId}/answer`);
      if (!response.ok) return false;
      const data = (await response.json()) as { text: string };
      return data.text.toLowerCase() === 'yes';
    },
    variables: {
      target: {
        step: 'trigger',
        path: 'target',
      },
    },
    snapshotOnTimeout: true,
  })
  .commit();

import { input } from '@inquirer/prompts';
import { Step, Workflow, getStepResult } from '@mastra/core/workflows';
import { z } from 'zod';

export const telephoneGameWorkflow = new Workflow({
  name: 'telephoneGame',
});

const stepA1 = new Step({
  id: 'stepA1',
  description: 'Starts the message',
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async () => {
    return {
      message: 'Test',
    };
  },
});

const stepA2 = new Step({
  id: 'stepA2',
  description: 'Pass the message through',
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async () => {
    const content = await input({
      message: 'Give me a message',
      validate: input => input.trim().length > 0 || 'Message cannot be empty',
    });

    return {
      message: content,
    };
  },
});

const stepB2 = new Step({
  id: 'stepB2',
  description: 'Checks if the file exists',
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ context }) => {
    if (context.machineContext?.stepResults.stepA2?.status !== 'success') {
      throw new Error('Message not found');
    }

    const msg = context.machineContext.stepResults.stepA2.payload.message;

    return {
      message: msg,
    };
  },
});

const stepC2 = new Step({
  id: 'stepC2',
  description: 'Ask if you should modify the message',
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ suspend, context, mastra }) => {
    const oMsg = getStepResult(context?.machineContext?.stepResults.stepA2);
    if (context?.machineContext?.stepResults.stepC2?.status === 'success') {
      const msg = getStepResult(context?.machineContext?.stepResults.stepC2);
      if (msg.confirm) {
        if (mastra?.llm) {
          const llm = mastra?.llm({
            provider: 'ANTHROPIC',
            name: 'claude-3-5-haiku-20241022',
          });
          const result = await llm.generate(`
            You are playing a game of telephone.
            Here is the message the previous person sent ${oMsg.message}. 
            But you want to change the message. 
            Only return the message
            `);
          return {
            message: result.text,
          };
        }
      }

      return oMsg;
    }
    await suspend();
    return { message: 'Suspended' };
  },
});

const stepD2 = new Step({
  id: 'stepD2',
  description: 'Pass the message',
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const msg = getStepResult(context?.machineContext?.stepResults.stepC2);
    return msg;
  },
});

telephoneGameWorkflow.step(stepA1).step(stepA2).then(stepB2).then(stepC2).then(stepD2).commit();

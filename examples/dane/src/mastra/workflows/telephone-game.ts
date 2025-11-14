import { anthropic } from '@ai-sdk/anthropic';
import { input } from '@inquirer/prompts';
import { Agent } from '@mastra/core/agent';
import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';

const llm = anthropic('claude-3-5-sonnet-20241022');

const agent = new Agent({
  id: 'telephone-game-agent',
  name: 'Telephone Game Agent',
  instructions: `Telephone game agent`,
  model: llm,
});

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
      validate: value => value.trim().length > 0 || 'Message cannot be empty',
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
  execute: async (inputData, context) => {
    if (context?.workflow?.state?.steps.stepA2?.status !== 'success') {
      throw new Error('Message not found');
    }

    const msg = context.workflow.state.steps.stepA2.output.message;

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
  execute: async (inputData, context) => {
    if (!context?.workflow?.state?.steps.stepA2) {
      throw new Error('Previous step result not found');
    }

    const oMsg = context.workflow.state.steps.stepA2.output;

    if (context.workflow.resumeData?.confirm) {
      const result = await agent.generate(`
          You are playing a game of telephone.
          Here is the message the previous person sent ${oMsg.message}.
          But you want to change the message.
          Only return the message
          `);
      return {
        message: result.text,
      };
    }

    await context.workflow.suspend();
    return { message: 'Suspended' };
  },
});

const stepD2 = new Step({
  id: 'stepD2',
  description: 'Pass the message',
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async (inputData, context) => {
    if (!context?.workflow?.state?.steps.stepC2) {
      throw new Error('Previous step result not found');
    }

    return context.workflow.state.steps.stepC2.output;
  },
});

telephoneGameWorkflow.step(stepA1).step(stepA2).then(stepB2).then(stepC2).then(stepD2).commit();

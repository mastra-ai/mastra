import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const copywriterAgent = new Agent({
  name: 'Copywriter',
  instructions: 'You are a copywriter agent that writes blog post copy.',
  model: anthropic('claude-3-5-sonnet-20241022'),
});

const copywriterStep = createStep({
  id: 'copywriterStep',
  inputSchema: z.object({
    topic: z.string(),
  }),
  outputSchema: z.object({
    copy: z.string(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData?.topic) {
      throw new Error('Topic not found in trigger data');
    }
    const result = await copywriterAgent.generate(`Create a blog post about ${inputData.topic}`);
    console.log('copywriter result', result.text);
    return {
      copy: result.text,
    };
  },
});

const editorAgent = new Agent({
  name: 'Editor',
  instructions: 'You are an editor agent that edits blog post copy.',
  model: openai('gpt-4o-mini'),
});

const editorStep = createStep({
  id: 'editorStep',
  inputSchema: z.object({
    copy: z.string(),
  }),
  outputSchema: z.object({
    finalCopy: z.string(),
  }),
  execute: async ({ inputData }) => {
    const copy = inputData?.copy;

    const result = await editorAgent.generate(`Edit the following blog post only returning the edited copy: ${copy}`);
    console.log('editor result', result.text);
    return {
      finalCopy: result.text,
    };
  },
});

const myWorkflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({
    topic: z.string(),
  }),
  outputSchema: z.object({
    finalCopy: z.string(),
  }),
});

// Run steps sequentially.
myWorkflow.then(copywriterStep).then(editorStep).commit();

const run = await myWorkflow.createRunAsync();

const res = await run.start({ inputData: { topic: 'React JavaScript frameworks' } });
console.log('Response: ', res);

import { Agent, Step, Workflow } from '@mastra/core';
import { z } from 'zod';

const copywriterAgent = new Agent({
  name: 'Copywriter',
  instructions: 'You are a copywriter agent that writes blog post copy.',
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-3-5-sonnet-20241022',
    toolChoice: 'required',
  },
});

const copywriterStep = new Step({
  id: 'copywriterStep',
  execute: async ({ context: { machineContext } }) => {
    if (!machineContext?.triggerData?.topic) {
      throw new Error('Topic not found in trigger data');
    }
    const result = await copywriterAgent.generate(`Create a blog post about ${machineContext.triggerData.topic}`);
    console.log('copywriter result', result.text);
    return {
      copy: result.text,
    };
  },
});

const editorAgent = new Agent({
  name: 'Editor',
  instructions: 'You are an editor agent that edits blog post copy.',
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o',
  },
});

const editorStep = new Step({
  id: 'editorStep',
  execute: async ({ context }) => {
    const copy = context?.machineContext?.getStepPayload<{ copy: number }>('copywriterStep')?.copy;

    const result = await editorAgent.generate(`Edit the following blog post only returning the edited copy: ${copy}`);
    console.log('editor result', result.text);
    return {
      copy: result.text,
    };
  },
});

const myWorkflow = new Workflow({
  name: 'my-workflow',
  triggerSchema: z.object({
    topic: z.string(),
  }),
});

// Run steps sequentially.
myWorkflow.step(copywriterStep).then(editorStep).commit();

const { runId, start } = myWorkflow.createRun();

const res = await start({ triggerData: { topic: 'React JavaScript frameworks' } });
console.log('Results: ', res.results);

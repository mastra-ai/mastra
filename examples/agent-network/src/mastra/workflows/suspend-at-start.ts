import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';

const humanInputStep = new Step({
  id: 'human-input',
  outputSchema: z.object({
    feedback: z.string().optional().describe('The selection of the user'),
  }),
  execute: async ({ context, suspend }) => {
    const { inputData } = context;
    console.log('human input step', inputData);
    if (!inputData?.feedback) {
      console.log('suspend');
      await suspend();
      return { feedback: undefined };
    }
    return { feedback: inputData?.feedback };
  },
});

const researchStep = new Step({
  id: 'research',
  outputSchema: z.object({
    research: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    const researchAgent = mastra?.getAgent('researchAgent');
    if (!researchAgent) {
      throw new Error('Research agent is not initialized');
    }

    const researchAgentOutput = context?.getStepResult(researchStep);
    const factCheckAgentOutput = context?.getStepResult(factCheckStep);

    const { prompt } = context?.getStepResult('trigger');
    const result = await researchAgent.stream([
      { role: 'assistant', content: `Prompt: ${prompt}` },
      { role: 'assistant', content: `Research: ${researchAgentOutput}` },
      { role: 'assistant', content: `Fact check: ${factCheckAgentOutput}` },
      { role: 'user', content: 'Please continue the research' },
    ]);

    let researchText = '';
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
      researchText += chunk;
    }
    return { research: researchText };
  },
});

const factCheckStep = new Step({
  id: 'fact-check',
  outputSchema: z.object({
    factCheck: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    const factCheckAgent = mastra?.getAgent('factCheckAgent');
    if (!factCheckAgent) {
      throw new Error('Fact check agent is not initialized');
    }

    const { research } = context?.getStepResult(researchStep);
    const { editor } = context?.getStepResult(editorStep);
    const result = await factCheckAgent.stream([
      { role: 'assistant', content: research },
      { role: 'assistant', content: editor },
      { role: 'user', content: 'Please fact check the research and editor' },
    ]);

    let factCheckText = '';
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
      factCheckText += chunk;
    }
    return { factCheck: factCheckText };
  },
});

const editorStep = new Step({
  id: 'editor',
  outputSchema: z.object({
    editor: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    const editorAgent = mastra?.getAgent('editorAgent');
    if (!editorAgent) {
      throw new Error('Editor agent is not initialized');
    }

    const { factCheck } = context?.getStepResult(factCheckStep);
    const { research } = context?.getStepResult(researchStep);
    const { editor } = context?.getStepResult(editorStep);
    const result = await editorAgent.stream([
      { role: 'assistant', content: `Fact check: ${factCheck}` },
      { role: 'assistant', content: `Research: ${research}` },
      { role: 'assistant', content: `Editor: ${editor}` },
      {
        role: 'user',
        content: 'Please edit the research and editor writing using the fact checking',
      },
    ]);

    let editorText = '';
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
      editorText += chunk;
    }
    return { editor: editorText };
  },
});

const startStep = new Step({
  id: 'start',
  outputSchema: z.object({
    feedback: z.string(),
  }),
  execute: async ({ context, suspend }) => {
    // const inputData = context.getStepResult(humanInputStep)
    // console.log()
    // console.log()
    // console.log()
    // console.log('inputData', inputData)
    // if (!inputData?.feedback) {
    //   return { feedback: 'research' }
    // }
    // return { feedback: inputData?.feedback }

    const { inputData } = context;
    console.log('human input step', inputData);
    if (!inputData?.feedback) {
      console.log('suspend');
      await suspend();
      return { feedback: undefined };
    }
    return { feedback: inputData?.feedback };
  },
});

export const agentNetworkWorkflowSuspendAtStart = new Workflow({
  name: 'agent-network-workflow-suspend-at-start',
  triggerSchema: z.object({
    prompt: z.string().describe('The prompt for the agent network'),
  }),
});

agentNetworkWorkflowSuspendAtStart
  .step(startStep)
  .after(startStep)
  .step(researchStep, {
    when: async ({ context }) => {
      const inputData = context.getStepResult(startStep);
      return inputData?.feedback === 'research';
    },
  })
  .step(factCheckStep, {
    when: async ({ context }) => {
      const inputData = context.getStepResult(startStep);
      return inputData?.feedback === 'factCheck';
    },
  })
  .step(editorStep, {
    when: async ({ context }) => {
      const inputData = context.getStepResult(startStep);
      return inputData?.feedback === 'editor';
    },
  })
  .after([researchStep, factCheckStep, editorStep])
  .step(
    new Step({
      id: 'done',
      execute: async ({ context }) => {
        console.log('done');
      },
    }),
  )
  .until(async ({ context }) => {
    const inputData = context.getStepResult(humanInputStep);
    return inputData?.feedback === 'done';
  }, startStep)
  .commit();

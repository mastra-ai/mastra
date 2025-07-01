import { createWorkflow, createStep } from '@mastra/core/workflows';

import { z } from 'zod';

const generateSuggestionsStep = createStep({
  id: 'generate-suggestions',
  inputSchema: z.object({
    vacationDescription: z.string().describe('The description of the vacation'),
  }),
  outputSchema: z.object({
    suggestions: z.array(z.string()),
    vacationDescription: z.string(),
  }),
  execute: async ({ inputData, mastra, abortSignal, abort }) => {
    if (!mastra) {
      throw new Error('Mastra is not initialized');
    }

    const { vacationDescription } = inputData;
    const result = await mastra.getAgent('summaryTravelAgent').generate(
      [
        {
          role: 'user',
          content: vacationDescription,
        },
      ],
      {
        abortSignal,
      },
    );

    if (abortSignal.aborted) {
      return abort();
    }

    console.log(result.text);
    return { suggestions: JSON.parse(result.text), vacationDescription };
  },
});

const humanInputStep = createStep({
  id: 'human-input',
  inputSchema: z.object({
    suggestions: z.array(z.string()),
    vacationDescription: z.string(),
  }),
  outputSchema: z.object({
    selection: z.string().describe('The selection of the user'),
    vacationDescription: z.string(),
  }),
  resumeSchema: z.object({
    selection: z.string().describe('The selection of the user'),
  }),
  suspendSchema: z.object({
    suggestions: z.array(z.string()),
  }),
  execute: async ({ inputData, resumeData, suspend, getInitData }) => {
    if (!resumeData?.selection) {
      await suspend({ suggestions: inputData?.suggestions });
      return {
        selection: '',
        vacationDescription: inputData?.vacationDescription,
      };
    }

    return {
      selection: resumeData?.selection,
      vacationDescription: inputData?.vacationDescription,
    };
  },
});

const travelPlannerStep = createStep({
  id: 'travel-planner',
  inputSchema: z.object({
    selection: z.string().describe('The selection of the user'),
    vacationDescription: z.string(),
  }),
  outputSchema: z.object({
    travelPlan: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const travelAgent = mastra?.getAgent('travelAgent');
    if (!travelAgent) {
      throw new Error('Travel agent is not initialized');
    }

    const { selection, vacationDescription } = inputData;
    const result = await travelAgent.generate([
      { role: 'assistant', content: vacationDescription },
      { role: 'user', content: selection || '' },
    ]);
    console.log(result.text);
    return { travelPlan: result.text };
  },
});

const travelAgentWorkflow = createWorkflow({
  id: 'travel-agent-workflow-step4-suspend-resume',
  inputSchema: z.object({
    vacationDescription: z.string().describe('The description of the vacation'),
  }),
  outputSchema: z.object({
    travelPlan: z.string(),
  }),
})
  .then(generateSuggestionsStep)
  .then(humanInputStep)
  .then(travelPlannerStep);

travelAgentWorkflow.commit();

export { travelAgentWorkflow, humanInputStep };

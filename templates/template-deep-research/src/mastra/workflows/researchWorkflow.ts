import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

// Step 1: Get user query
const getUserQueryStep = createStep({
  id: 'get-user-query',
  inputSchema: z.object({}),
  outputSchema: z.object({
    query: z.string(),
  }),
  resumeSchema: z.object({
    query: z.string(),
  }),
  suspendSchema: z.object({
    message: z.object({
      query: z.string(),
    }),
  }),
  execute: async ({ resumeData, suspend }) => {
    if (resumeData) {
      return {
        ...resumeData,
        query: resumeData.query || '',
      };
    }

    await suspend({
      message: {
        query: 'What would you like to research?',
      },
    });

    return {
      query: '',
    };
  },
});

// Step 2: Research
const researchStep = createStep({
  id: 'research',
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    researchData: z.any(),
    summary: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { query } = inputData;

    try {
      const agent = mastra.getAgent('researchAgent');
      const researchPrompt = `Research the following topic thoroughly using the two-phase process: "${query}".

      Phase 1: Search for 2-3 initial queries about this topic
      Phase 2: Search for follow-up questions from the learnings (then STOP)

      Return findings in JSON format with queries, searchResults, learnings, completedQueries, and phase.`;

      const result = await agent.generate(
        [
          {
            role: 'user',
            content: researchPrompt,
          },
        ],
        {
          maxSteps: 15,
          experimental_output: z.object({
            queries: z.array(z.string()),
            searchResults: z.array(
              z.object({
                title: z.string(),
                url: z.string(),
                relevance: z.string(),
              }),
            ),
            learnings: z.array(
              z.object({
                learning: z.string(),
                followUpQuestions: z.array(z.string()),
                source: z.string(),
              }),
            ),
            completedQueries: z.array(z.string()),
            phase: z.string().optional(),
          }),
        },
      );

      // Create a summary
      const summary = `Research completed on "${query}:" \n\n ${JSON.stringify(result.object, null, 2)}\n\n`;

      return {
        researchData: result.object,
        summary,
      };
    } catch (error: any) {
      console.log({ error });
      return {
        researchData: { error: error.message },
        summary: `Error: ${error.message}`,
      };
    }
  },
});

// Step 3: Get user approval
const approvalStep = createStep({
  id: 'approval',
  inputSchema: z.object({
    researchData: z.any(),
    summary: z.string(),
  }),
  outputSchema: z.object({
    approved: z.boolean(),
    researchData: z.any(),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (resumeData) {
      return {
        ...resumeData,
        researchData: inputData.researchData,
      };
    }

    await suspend({
      summary: inputData.summary,
      message: `Is this research sufficient? [y/n] `,
    });

    return {
      approved: false,
      researchData: inputData.researchData,
    };
  },
});

// Define the workflow
export const researchWorkflow = createWorkflow({
  id: 'research-workflow',
  inputSchema: z.object({}),
  outputSchema: z.object({
    approved: z.boolean(),
    researchData: z.any(),
  }),
  steps: [getUserQueryStep, researchStep, approvalStep],
});

researchWorkflow.then(getUserQueryStep).then(researchStep).then(approvalStep).commit();

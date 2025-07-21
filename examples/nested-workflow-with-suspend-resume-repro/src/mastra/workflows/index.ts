import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Steps that will be used in nested workflows to reproduce the bug
const step1 = createStep({
  id: 'step-1',
  inputSchema: z.object({
    suspect: z.string(),
  }),
  outputSchema: z.object({
    suspect: z.string(),
  }),
  suspendSchema: z.object({ message: z.string() }),
  resumeSchema: z.object({
    suspect: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData?.suspect) {
      return suspend({ message: 'What is the suspect?' });
    }
    return {
      suspect: resumeData.suspect,
    };
  },
});

const step2 = createStep({
  id: 'step-2',
  inputSchema: z.object({
    suspect: z.string(),
  }),
  outputSchema: z.object({
    suspect: z.string(),
  }),
  suspendSchema: z.object({ message: z.string() }),
  resumeSchema: z.object({
    suspect: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData?.suspect) {
      return suspend({ message: 'What is the second suspect?' });
    }
    return {
      suspect: resumeData.suspect,
    };
  },
});

// Create the nested workflows that reproduce the bug
const subWorkflow1 = createWorkflow({
  id: 'sub-workflow-1',
  inputSchema: z.object({
    suspect: z.string(),
  }),
  outputSchema: z.object({
    suspect: z.string(),
  }),
})
  .then(step1)
  .commit();

const subWorkflow2 = createWorkflow({
  id: 'sub-workflow-2',
  inputSchema: z.object({
    suspect: z.string(),
  }),
  outputSchema: z.object({
    suspect: z.string(),
  }),
})
  .then(step2)
  .commit();

// The workaround: dummy suspend step between nested workflows
const dummySuspend = createStep({
  id: 'dummy-suspend',
  inputSchema: z.object({
    suspect: z.string(),
  }),
  outputSchema: z.object({
    suspect: z.string(),
  }),
  suspendSchema: z.object({ message: z.string() }),
  resumeSchema: z.object({
    done: z.boolean(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData?.done) {
      return suspend({ message: 'Just a dummy suspend step' });
    }
    return { suspect: inputData.suspect }; // Pass through the suspect
  },
});

// This is the problematic workflow that should reproduce the bug
export const buggyWorkflow = createWorkflow({
  id: 'suspend-suspect-buggy',
  inputSchema: z.object({
    suspect: z.string(),
  }),
  outputSchema: z.object({
    suspect: z.string(),
  }),
})
  .then(subWorkflow1) // NestedWorkflow1 (with suspend)
  .then(subWorkflow2) // NestedWorkflow2 (with suspend) - this should cause the error
  .commit();

// This workflow includes the workaround (dummy suspend step)
export const workaroundWorkflow = createWorkflow({
  id: 'suspend-suspect-workaround',
  inputSchema: z.object({
    suspect: z.string(),
  }),
  outputSchema: z.object({
    suspect: z.string(),
  }),
})
  .then(subWorkflow1) // NestedWorkflow1 (with suspend)
  .then(dummySuspend) // WORKAROUND: Dummy suspend step
  .then(subWorkflow2) // NestedWorkflow2 (with suspend) - should work now
  .commit();

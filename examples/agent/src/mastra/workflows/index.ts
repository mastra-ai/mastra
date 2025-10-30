import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

export const myWorkflow = createWorkflow({
  id: 'recipe-maker',
  description: 'Returns a recipe based on an ingredient',
  inputSchema: z.object({
    ingredient: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
});

const step = createStep({
  id: 'my-step',
  description: 'My step description',
  inputSchema: z.object({
    ingredient: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async ({ inputData }) => {
    await new Promise(resolve => setTimeout(resolve, 3000));
    return {
      result: inputData.ingredient,
    };
  },
});

const step2 = createStep({
  id: 'my-step-2',
  description: 'My step description',
  inputSchema: z.object({
    result: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async () => {
    await new Promise(resolve => setTimeout(resolve, 3000));
    return {
      result: 'suh',
    };
  },
});

myWorkflow.then(step).then(step2).commit();

// Simple step that adds a letter to a string
const addLetterStep = createStep({
  id: 'add-letter',
  inputSchema: z.object({
    text: z.string(),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { text } = inputData;
    await new Promise(resolve => setTimeout(resolve, 500));
    return { text: text + 'A' };
  },
});

// Step that adds a different letter
const addLetterBStep = createStep({
  id: 'add-letter-b',
  inputSchema: z.object({
    text: z.string(),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { text } = inputData;
    await new Promise(resolve => setTimeout(resolve, 500));
    return { text: text + 'B' };
  },
});

// Step that adds another letter
const addLetterCStep = createStep({
  id: 'add-letter-c',
  inputSchema: z.object({
    text: z.string(),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { text } = inputData;
    // Make sure it runs after the other branch
    await new Promise(resolve => setTimeout(resolve, 500));
    return { text: text + 'C' };
  },
});

// Step that adds a letter and tracks iteration count
const addLetterWithCountStep = createStep({
  id: 'add-letter-with-count',
  inputSchema: z.object({
    text: z.string(),
    iterationCount: z.number().optional(),
  }),
  outputSchema: z.object({
    text: z.string(),
    iterationCount: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { text, iterationCount = 0 } = inputData;
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      text: text + 'D',
      iterationCount: iterationCount + 1,
    };
  },
});

// Step with suspend/resume functionality
const suspendResumeStep = createStep({
  id: 'suspend-resume',
  inputSchema: z.object({
    text: z.string(),
    iterationCount: z.number(),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
  suspendSchema: z.object({
    reason: z.string(),
  }),
  resumeSchema: z.object({
    userInput: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const { text } = inputData;

    if (!resumeData?.userInput) {
      return await suspend({
        reason: 'Please provide user input to continue',
      });
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    return { text: text + resumeData.userInput };
  },
});

// Step for short text (used in conditional branching)
const shortTextStep = createStep({
  id: 'short-text',
  inputSchema: z.object({
    text: z.string(),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { text } = inputData;
    await new Promise(resolve => setTimeout(resolve, 500));
    return { text: text + 'S' };
  },
});

// Step for long text (used in conditional branching)
const longTextStep = createStep({
  id: 'long-text',
  inputSchema: z.object({
    text: z.string(),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { text } = inputData;
    await new Promise(resolve => setTimeout(resolve, 500));
    return { text: text + 'L' };
  },
});

const finalStep = createStep({
  id: 'final-step',
  inputSchema: z.object({
    text: z.string(),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { text } = inputData;
    await new Promise(resolve => setTimeout(resolve, 500));
    return { text: text + '-ENDED' };
  },
});

// Nested workflow that processes text
export const nestedTextProcessor = createWorkflow({
  id: 'nested-text-processor',
  inputSchema: z.object({
    text: z.string(),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
})
  .then(addLetterStep)
  .then(addLetterBStep)
  .commit();

export const lessComplexWorkflow = createWorkflow({
  id: 'lessComplexWorkflow',
  inputSchema: z.object({
    text: z.string(),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
})
  // Start with initial step
  .then(addLetterStep)

  // Parallel execution - both steps run simultaneously
  .parallel([addLetterBStep, addLetterCStep])

  // Map the parallel results back to a single text field
  .map(async ({ inputData }) => {
    const { 'add-letter-b': stepB, 'add-letter-c': stepC } = inputData;
    return { text: stepB.text + stepC.text };
  })

  // Conditional branching based on text length
  .branch([
    [async ({ inputData: { text } }) => text.length <= 10, shortTextStep],
    [async ({ inputData: { text } }) => text.length > 10, longTextStep],
  ])

  // Map the branch result back to a single text field
  .map(async ({ inputData }) => {
    // The branch step returns either short-text or long-text result
    const result = inputData['short-text'] || inputData['long-text'];
    return { text: result.text };
  })

  // Nested workflow
  .then(nestedTextProcessor)

  // doUntil loop - continues until text has 20+ characters
  .dountil(addLetterWithCountStep, async ({ inputData: { text } }) => text.length >= 20)

  // Final step
  .then(finalStep)
  .commit();

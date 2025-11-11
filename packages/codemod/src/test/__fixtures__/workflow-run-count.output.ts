// @ts-nocheck
import { createStep } from '@mastra/core/workflows';

const step = createStep({
  id: 'my-step',
  execute: async (inputData, context) => {
    // Should transform - accessing context.runCount
    console.log(`Step run ${context.retryCount} times`);
    
    const count = context.retryCount;
    
    if (context.retryCount > 3) {
      throw new Error('Too many retries');
    }
    
    return { result: 'success' };
  },
});

// Should NOT transform - different property name
const otherStep = createStep({
  id: 'other-step',
  execute: async (inputData, context) => {
    const customRunCount = 5; // Should not change
    return { customRunCount };
  },
});
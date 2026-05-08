// @ts-nocheck
import { createStep, createWorkflow } from '@mastra/core/workflows';

// Should transform - getInitData() in createStep execute
const step1 = createStep({
  id: 'step-1',
  execute: async ({ getInitData }) => {
    const initData = getInitData();
    if (initData.key === 'value') {
      console.log('matched');
    }
    return { result: initData.key };
  },
});

// Should transform - getInitData() in workflow .map()
const workflow = createWorkflow({
  id: 'my-workflow',
})
  .then(step1)
  .map(async ({ getInitData }) => {
    console.log(getInitData());
  });

// Should transform - multiple getInitData() calls
const step2 = createStep({
  id: 'step-2',
  execute: async ({ getInitData, inputData }) => {
    const data1 = getInitData();
    const data2 = getInitData();
    return { combined: data1.a + data2.b };
  },
});

// Should transform - getInitData() with property access
const step3 = createStep({
  id: 'step-3',
  execute: async ({ getInitData }) => {
    return { name: getInitData().name };
  },
});

// Should NOT transform - already has type parameter
const step4 = createStep({
  id: 'step-4',
  execute: async ({ getInitData }) => {
    const initData = getInitData<{ key: string }>();
    return { result: initData.key };
  },
});

// Should NOT transform - different function name
const step5 = createStep({
  id: 'step-5',
  execute: async ({ getStepResult }) => {
    const result = getStepResult('other-step');
    return { result };
  },
});

// Should NOT transform - getInitData as a variable assignment (not a call)
const getInitDataAlias = (fn: () => any) => fn;

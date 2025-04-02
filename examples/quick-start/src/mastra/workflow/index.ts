import { Workflow, Step } from '@mastra/core';
import { z } from 'zod';

const logCatName = new Step({
  id: 'logCatName',
  outputSchema: z.object({
    rawText: z.string(),
  }),
  execute: async ({ context }) => {
    const name = context?.getStepResult<{ name: string }>('trigger')?.name;
    console.log(`Hello, ${name} 🐈`);
    return { rawText: `Hello ${name}` };
  },
});

export const logCatWorkflow = new Workflow({
  name: 'log-cat-workflow',
  triggerSchema: z.object({
    name: z.string(),
  }),
});

logCatWorkflow.step(logCatName).commit();

const step1Action = async () => {
  return Promise.resolve({ status: 'success' });
};
const step2Action = async () => {
  return Promise.resolve({ result: 'step2' });
};
const step3Action = async () => {
  return Promise.resolve({ result: 'step3' });
};

const step1 = new Step({
  id: 'step1',
  execute: step1Action,
  outputSchema: z.object({ status: z.string() }),
});
const step2 = new Step({
  id: 'step2',
  execute: step2Action,
});
const step3 = new Step({ id: 'step3', execute: step3Action });

const simpleConditionalWorkflow = new Workflow({
  name: 'simple-conditional-workflow',
  triggerSchema: z.object({
    status: z.enum(['pending', 'success', 'failed']),
  }),
});

simpleConditionalWorkflow
  .step(step1, {
    variables: {
      status: { step: 'trigger', path: 'status' },
    },
  })
  .then(step2, {
    when: {
      ref: { step: step1, path: 'status' },
      query: { $eq: 'success' },
    },
  })
  .then(step3, {
    when: {
      ref: { step: step1, path: 'status' },
      query: { $eq: 'failed' },
    },
  })
  .commit();

const _step1 = new Step({
  id: 'step1',
  execute: async () => ({ status: 'success' }),
});
const _step2 = new Step({
  id: 'step2',
  execute: async () => ({ result: 'step2' }),
});
const _step3 = new Step({
  id: 'step3',
  execute: async () => ({ result: 'step3' }),
});

const simpleStringConditionalWorkflow = new Workflow({
  name: 'simple-string-conditional-workflow',
});
simpleStringConditionalWorkflow
  .step(_step1)
  .then(_step2, {
    when: {
      'step1.status': 'success',
    },
  })
  .then(_step3, {
    when: {
      'step2.status': 'unexpected value',
    },
  })
  .commit();

const __step1 = new Step({
  id: 'step1',
  execute: async () => ({ count: 5 }),
  outputSchema: z.object({ count: z.number() }),
});
const __step2 = new Step({
  id: 'step2',
  execute: async () => ({ result: 'step2' }),
});

const functionConditionalWorkflow = new Workflow({
  name: 'function-conditional-workflow',
});

functionConditionalWorkflow
  .step(__step1)
  .then(__step2, {
    when: async ({ context }) => {
      const step1Result = context.getStepResult(__step1);

      return step1Result ? step1Result.count > 3 : false;
    },
  })
  .commit();

const step1_ = new Step({
  id: 'step1',
  execute: async () => ({
    status: 'partial',
    score: 75,
    flags: { isValid: true },
  }),
  outputSchema: z.object({
    status: z.string(),
    score: z.number(),
    flags: z.object({ isValid: z.boolean() }),
  }),
});
const step2_ = new Step({
  id: 'step2',
  execute: async () => ({ result: 'step2' }),
  outputSchema: z.object({ result: z.string() }),
});
const step3_ = new Step({
  id: 'step3',
  execute: async () => ({ result: 'step3' }),
});

const complexConditionalWorkflow = new Workflow({
  name: 'complex-conditional-workflow',
});

complexConditionalWorkflow
  .step(step1_)
  .then(step2_, {
    when: {
      and: [
        {
          or: [
            {
              ref: { step: step1_, path: 'status' },
              query: { $eq: 'success' },
            },
            {
              and: [
                {
                  ref: { step: step1_, path: 'status' },
                  query: { $eq: 'partial' },
                },
                {
                  ref: { step: step1_, path: 'score' },
                  query: { $gte: 70 },
                },
              ],
            },
          ],
        },
        {
          ref: { step: step1_, path: 'flags.isValid' },
          query: { $eq: true },
        },
      ],
    },
  })
  .then(step3_, {
    when: {
      or: [
        {
          ref: { step: step1_, path: 'status' },
          query: { $eq: 'failed' },
        },
        {
          ref: { step: step1_, path: 'score' },
          query: { $lt: 70 },
        },
      ],
    },
  })
  .commit();

const increment = async ({ context }) => {
  // Get the current value (either from trigger or previous increment)
  const currentValue =
    context.getStepResult('increment')?.newValue || context.getStepResult('trigger')?.startValue || 0;

  // Increment the value
  const newValue = currentValue + 1;

  return { newValue };
};
const incrementStep = new Step({
  id: 'increment',
  description: 'Increments the current value by 1',
  outputSchema: z.object({
    newValue: z.number(),
  }),
  execute: increment,
});

const final = async ({ context }: { context: any }) => {
  return { finalValue: context.getStepResult(incrementStep).newValue };
};
const finalStep = new Step({
  id: 'final',
  description: 'Final step that prints the result',
  execute: final,
});

const untilLoopWorkflow = new Workflow<[typeof incrementStep, typeof finalStep]>({
  name: 'until-loop-workflow',
  triggerSchema: z.object({
    target: z.number(),
    startValue: z.number(),
  }),
});

untilLoopWorkflow
  .step(incrementStep)
  .until(async ({ context }) => {
    const res = context.getStepResult('increment');
    return (res?.newValue ?? 0) >= 12;
  }, incrementStep)
  .then(finalStep)
  .commit();

const whileLoopWorkflow = new Workflow({
  name: 'while-loop-workflow',
  triggerSchema: z.object({
    target: z.number(),
    startValue: z.number(),
  }),
});

whileLoopWorkflow
  .step(incrementStep)
  .while(
    {
      ref: { step: incrementStep, path: 'newValue' },
      query: { $lt: 10 },
    },
    incrementStep,
  )
  .then(finalStep)
  .commit();

const whileLoopWithConditionFunctionWorkflow = new Workflow({
  name: 'while-loop-with-condition-function-workflow',
  triggerSchema: z.object({
    target: z.number(),
    startValue: z.number(),
  }),
});

whileLoopWithConditionFunctionWorkflow
  .step(incrementStep)
  .while(async ({ context }) => {
    const res = context.getStepResult<{ newValue: number }>('increment');
    return (res?.newValue ?? 0) < 10;
  }, incrementStep)
  .then(finalStep)
  .commit();

const start = async ({ context }) => {
  // Get the current value (either from trigger or previous increment)
  const currentValue = context.getStepResult('start')?.newValue || context.getStepResult('trigger')?.startValue || 0;

  // Increment the value
  const newValue = currentValue + 1;

  return { newValue };
};
const startStep = new Step({
  id: 'start',
  description: 'Increments the current value by 1',
  outputSchema: z.object({
    newValue: z.number(),
  }),
  execute: start,
});

const other = async ({ context }) => {
  return { other: 26 };
};
const otherStep = new Step({
  id: 'other',
  description: 'Other step',
  execute: other,
});

const _final = async ({ context }) => {
  const startVal = context.getStepResult('start')?.newValue ?? 0;
  const otherVal = context.getStepResult('other')?.other ?? 0;
  return { finalValue: startVal + otherVal };
};
const _finalStep = new Step({
  id: 'final',
  description: 'Final step that prints the result',
  execute: _final,
});

const ifThenWorkflow = new Workflow({
  name: 'if-then-workflow',
  triggerSchema: z.object({
    startValue: z.number(),
  }),
});

ifThenWorkflow
  .step(startStep)
  .if(async ({ context }) => {
    const current = context.getStepResult<{ newValue: number }>('start')?.newValue;
    return !current || current < 5;
  })
  .then(_finalStep)
  .else()
  .then(otherStep)
  .then(_finalStep)
  .commit();

const ifElseWithRefConditionWorkflow = new Workflow({
  name: 'if-else-with-ref-condition-workflow',
  triggerSchema: z.object({
    startValue: z.number(),
  }),
});

ifElseWithRefConditionWorkflow
  .step(startStep)
  .if({
    ref: { step: startStep, path: 'newValue' },
    query: { $lt: 5 },
  })
  .then(_finalStep)
  .else()
  .then(otherStep)
  .then(_finalStep)
  .commit();

const nestedIfThenWorkflow = new Workflow({
  name: 'nested-if-then-workflow',
  triggerSchema: z.object({
    startValue: z.number(),
  }),
});

nestedIfThenWorkflow
  .step(startStep)
  .if(async ({ context }) => {
    const current = context.getStepResult<{ newValue: number }>('start')?.newValue;
    return !current || current > 5;
  })
  .then(_finalStep)
  .else()
  .if(async ({ context }) => {
    const current = context.getStepResult<{ newValue: number }>('start')?.newValue;
    return current === 2;
  })
  .then(otherStep)
  .then(_finalStep)
  .else()
  .then(_finalStep)
  .commit();

const nestedIfAndNestedElseWorkflow = new Workflow({
  name: 'nested-if-and-nested-else-workflow',
  triggerSchema: z.object({
    startValue: z.number(),
  }),
});

nestedIfAndNestedElseWorkflow
  .step(startStep)
  .if(async ({ context }) => {
    const current = context.getStepResult<{ newValue: number }>('start')?.newValue;
    return !current || current < 5;
  })
  .if(async ({ context }) => {
    const current = context.getStepResult<{ newValue: number }>('start')?.newValue;
    return current === 2;
  })
  .then(otherStep)
  .then(_finalStep)
  .else()
  .then(_finalStep)

  .else()
  .then(_finalStep)
  .commit();

const ifThenWithUntilLoopWorkflow = new Workflow<[typeof incrementStep, typeof finalStep]>({
  name: 'if-then-with-until-loop-workflow',
  triggerSchema: z.object({
    target: z.number(),
    startValue: z.number(),
  }),
});

ifThenWithUntilLoopWorkflow
  .step(incrementStep)
  .if(async ({ context }) => {
    return false;
  })
  .then(incrementStep)
  .until(async ({ context }) => {
    const res = context.getStepResult('increment');
    return (res?.newValue ?? 0) >= 12;
  }, incrementStep)
  .then(_finalStep)
  .else()
  .then(otherStep)
  .then(_finalStep)
  .commit();

const step1__ = new Step({
  id: 'step1',
  execute: async () => ({ result: 'success1' }),
});
const step2__ = new Step({
  id: 'step2',
  execute: async () => ({ result: 'success2' }),
});
const step3__ = new Step({
  id: 'step3',
  execute: async () => ({ result: 'success3' }),
});
const step4__ = new Step({
  id: 'step4',
  execute: async () => ({ result: 'success4' }),
});
const step5__ = new Step({
  id: 'step5',
  execute: async () => ({ result: 'success5' }),
});

const parallelWorkflow = new Workflow({ name: 'parallel-workflow' });
parallelWorkflow.step(step1__).then(step2__).then(step3__).step(step4__).then(step5__).commit();

const simpleAfterWorkflow = new Workflow({ name: 'simple-after-workflow' });
simpleAfterWorkflow
  .step(step1__)
  .then(step2__)
  .then(step5__)
  .after(step1__)
  .step(step3__)
  .then(step4__)
  .then(step5__)
  .commit();

const _step1_ = new Step({
  id: 'step1',
  execute: async () => ({ status: 'success1' }),
  outputSchema: z.object({ status: z.string() }),
});

const afterWithConditionalWorkflow = new Workflow({
  name: 'after-with-conditional-workflow',
});
afterWithConditionalWorkflow
  .step(_step1_)
  .then(step2__)
  .then(step5__)
  .after(_step1_)
  .step(step3__, {
    when: {
      ref: { step: _step1_, path: 'status' },
      query: { $eq: 'failed' },
    },
  })
  .then(step4__)
  .then(step5__)
  .commit();

const compoundAfterWorkflow = new Workflow({ name: 'compound-after-workflow' });

compoundAfterWorkflow
  .step(step1__)
  .then(step2__)
  .then(step5__)
  .after([step1__, step5__])
  .step(step3__)
  .then(step4__)
  .then(step5__)
  .commit();

const step6 = new Step({
  id: 'step6',
  execute: async () => ({ result: 'success6' }),
});
const step7 = new Step({
  id: 'step7',
  execute: async () => ({ result: 'success7' }),
});
const step8 = new Step({
  id: 'step8',
  execute: async () => ({ result: 'success8' }),
});

const complexCompoundAfterWorkflow = new Workflow({
  name: 'complex-compound-after-workflow',
});
complexCompoundAfterWorkflow
  .step(step1__)
  .then(step2__)
  .then(step5__)
  .after([step1__, step5__])
  .step(step3__)
  .then(step4__)
  .then(step5__)
  .after([step3__, step4__])
  .step(step6)
  .then(step8)
  .then(step7)
  .after(step5__)
  .step(step8)
  .commit();

const fullNestedWorkflow = new Workflow({
  name: 'full-nested-workflow',
  triggerSchema: z.object({
    startValue: z.number(),
  }),
});

const wfA = new Workflow({ name: 'nested-workflow-a' }).step(startStep).then(otherStep).then(finalStep).commit();
const wfB = new Workflow({ name: 'nested-workflow-b' }).step(startStep).then(finalStep).commit();
fullNestedWorkflow
  .step(wfA)
  .step(wfB)
  .after([wfA, wfB])
  .step(
    new Step({
      id: 'last-step',
      execute: async () => {
        return { success: true };
      },
    }),
  )
  .commit();

const fullNestedWorkflowWithCondition = new Workflow({
  name: 'full-nested-workflow-with-condition',
  triggerSchema: z.object({
    startValue: z.number(),
  }),
});

const wfAD = new Workflow({ name: 'nested-workflow-ad' }).step(startStep).then(otherStep).then(finalStep).commit();
const wfBD = new Workflow({ name: 'nested-workflow-bd' })
  .step(startStep)
  .if(async ({ context }) => false)
  .then(otherStep)
  .else()
  .then(finalStep)
  .commit();
fullNestedWorkflowWithCondition
  .step(wfAD)
  .step(wfBD)
  .after([wfAD, wfBD])
  .step(
    new Step({
      id: 'last-step',
      execute: async () => {
        return { success: true };
      },
    }),
  )
  .commit();

const nestedWithNewIfWorkflow = new Workflow({ name: 'nested-with-new-if-workflow' })
  .step(
    new Step({
      id: 'first-step',
      execute: async ({ context }) => {
        return { success: true };
      },
    }),
  )
  .if(async ({ context }) => true, wfA, wfB)
  .then(
    new Step({
      id: 'last-step',
      execute: async ({ context }) => {
        return { success: true };
      },
    }),
  )
  .commit();

export {
  simpleConditionalWorkflow,
  simpleStringConditionalWorkflow,
  functionConditionalWorkflow,
  complexConditionalWorkflow,
  untilLoopWorkflow,
  whileLoopWorkflow,
  whileLoopWithConditionFunctionWorkflow,
  ifThenWorkflow,
  ifElseWithRefConditionWorkflow,
  nestedIfThenWorkflow,
  nestedIfAndNestedElseWorkflow,
  ifThenWithUntilLoopWorkflow,
  parallelWorkflow,
  simpleAfterWorkflow,
  afterWithConditionalWorkflow,
  compoundAfterWorkflow,
  complexCompoundAfterWorkflow,
  fullNestedWorkflow,
  fullNestedWorkflowWithCondition,
  nestedWithNewIfWorkflow,
};

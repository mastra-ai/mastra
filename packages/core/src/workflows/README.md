# Mastra vNext Workflows

Hi everyone!

We've made some significant improvements to our framework based on real-world usage and your feedback.

## The Problem

Our original architecture had limitations:

- We first started Workflows before Mastra when we were building a CRM and those design patterns restricted its potential
- The `.after([])` pattern created unnecessary complexity
- Users want to bring their own Workflow engines to Mastra (Temporal, Inngest, Cloudflare Workflows)
- Complex control flows became difficult to reason about and manage
- Our attempts to patch the shortcomings with nested workflows and conditional branching highlighted deeper design issues

We are opening up this `vNext` version of Workflows in a specific version tag to get feedback from the ground up. We hope you like the improvements so without further ado, let's dive in.

## What's new

### Streamlined Control Flow

- Nested Workflows are now first-class citizens and the first primitive to reach for when composing complex workflows
- Looping (`while` or `until`) accepts a single Step or Workflow and repeats until conditions are met
  - For infinite loops, you can loop a Nested Workflow from your "main workflow"
- `.branch()` replaces if/else, providing clearer conditional paths. Each truthy condition executes in parallel.
  - Branching creates a visual mental model of forking paths in a tree, which accurately represents workflow conditions
- `.parallel()` for simple concurrent execution
- `.then()` is now the universal connector (`.step()` has been retired)

### Better Type Safety

- All steps require input and output schemas
- A step's input is:
  - For the first step: the input provided to the workflow
  - For subsequent steps: the output of the previous step
- Parallel and branching operations return a union of the step results `{ [stepId]: output }`
- Workflow outputs are defined as the final executed step's output
- You can pass a resumeSchema argument for type safety when resuming a step
  - The payload is passed into the execute function as resumeData
  - Makes it easier to identify when a step is being resumed
  - Helps separate inputs from previous steps and the resume context

### Improved Development Experience

- Agents and tools can be easily integrated with `createStep()`

## Docs

This guide explains how to use the new API and highlights key differences from the original workflow implementation.

## Table of Contents

- [Getting Started](#getting-started)
- [Key Concepts](#key-concepts)
- [Creating Workflows](#creating-workflows)
  - [Steps](#steps)
  - [Workflow Structure](#workflow-structure)
  - [Flow Control](#flow-control)
    - [Sequential Flow](#sequential-flow)
    - [Parallel Execution](#parallel-execution)
    - [Conditional Branching](#conditional-branching)
    - [Loops](#loops)
    - [Variable Mapping](#variable-mapping)
  - [User Interaction with Suspend/Resume](#user-interaction-with-suspendresume)
- [Running Workflows](#running-workflows)
- [Nested Workflows](#nested-workflows)
- [Agent Integration](#agent-integration)
- [Differences from Original Workflow API](#differences-from-original-workflow-api)
- [Examples](#examples)

## Getting Started

To use vNext workflows, first import the necessary functions from the vNext module:

```typescript
import { createWorkflow, createStep } from '@mastra/core/workflows/vNext';
import { z } from 'zod'; // For schema validation
```

## Key Concepts

vNext workflows consist of:

- **Steps**: Individual units of work with defined inputs and outputs
- **Workflows**: Orchestrations of steps with defined execution patterns
- **Schemas**: Type definitions for inputs and outputs using Zod

## Creating Workflows

### Steps

Steps are the building blocks of workflows. Create a step using `createStep`:

```typescript
const inputSchema = z.object({
  inputValue: z.string(),
});

const myStep = createStep({
  id: 'my-step',
  description: 'Does something useful',
  inputSchema,
  outputSchema: z.object({
    outputValue: z.string(),
  }),
  resumeSchema: z.object({
    resumeValue: z.string(),
  }),
  suspendSchema: z.object({
    suspendValue: z.string(),
  }),
  execute: async ({ inputData, mastra, getStepResult, getInitData, runtimeContext }) => {
    const otherStepOutput = getStepResult(step2);
    const initData = getInitData<typeof inputSchema>(); // typed as the workflow input schema
    return {
      outputValue: `Processed: ${inputData.inputValue}, ${initData.startValue} (runtimeContextValue: ${runtimeContext.get('runtimeContextValue')})`,
    };
  },
});
```

Each step requires:

- `id`: Unique identifier for the step
- `inputSchema`: Zod schema defining expected input
- `outputSchema`: Zod schema defining output shape
- `resumeSchema`: Optional. Zod schema defining resume input
- `suspendSchema`: Optional. Zod schema defining suspend input
- `execute`: Async function that performs the step's work

The `execute` function receives a context object with:

- `inputData`: The input data matching the inputSchema
- `resumeData`: The resume data matching the resumeSchema, when resuming the step from a suspended state. Only exists if the step is being resumed.
- `mastra`: Access to mastra services (agents, tools, etc.)
- `getStepResult`: Function to access results from other steps
- `getInitData`: Function to access the initial input data of the workflow in any step
- `suspend`: Function to pause workflow execution (for user interaction)

### Workflow Structure

Create a workflow using `createWorkflow`:

```typescript
const myWorkflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({
    startValue: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  steps: [step1, step2, step3], // Declare steps used in this workflow
});

const mastra = new Mastra({
  vnext_workflows: {
    myWorkflow,
  },
});

const run = await mastra.vnext_getWorkflow('myWorkflow').createRunAsync();
```

The `steps` property in the workflow options provides type safety for accessing step results. When you declare the steps used in your workflow, TypeScript will ensure type safety when accessing `result.steps`:

```typescript
// With steps declared in workflow options
const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  steps: [step1, step2], // TypeScript knows these steps exist
});

const run = await workflow.createRunAsync();
const result = await run.start({ inputData: {} });
if (result.status === 'success') {
  console.log(result.result); // only exists if status is success
} else if (result.status === 'failed') {
  console.error(result.error); // only exists if status is failed, this is an instance of Error
  throw result.error;
} else if (result.status === 'suspended') {
  console.log(result.suspended); // only exists if status is suspended
}

// TypeScript knows these properties exist and their types
console.log(result.steps.step1.output); // Fully typed
console.log(result.steps.step2.output); // Fully typed
```

Workflow definition requires:

- `id`: Unique identifier for the workflow
- `inputSchema`: Zod schema defining workflow input
- `outputSchema`: Zod schema defining workflow output
- `steps`: Array of steps used in the workflow (optional, but recommended for type safety)

### Re-using steps and nested workflows

You can re-use steps and nested workflows by cloning them:

```typescript
const clonedStep = cloneStep(myStep, { id: 'cloned-step' });
const clonedWorkflow = cloneWorkflow(myWorkflow, { id: 'cloned-workflow' });
```

This way you can use the same step or nested workflow in the same workflow multiple times.

```typescript
import { createWorkflow, createStep, cloneStep, cloneWorkflow } from '@mastra/core/workflows/vNext';

const myWorkflow = createWorkflow({
  id: 'my-workflow',
  steps: [step1, step2, step3],
});
myWorkflow.then(step1).then(step2).then(step3).commit();

const parentWorkflow = createWorkflow({
  id: 'parent-workflow',
  steps: [myWorkflow, step4],
});
parentWorkflow
  .then(myWorkflow)
  .then(step4)
  .then(cloneWorkflow(myWorkflow, { id: 'cloned-workflow' }))
  .then(cloneStep(step4, { id: 'cloned-step-4' }))
  .commit();
```

### Flow Control

vNext workflows provide flexible flow control mechanisms.

#### Sequential Flow

Chain steps to execute in sequence using `.then()`:

```typescript
myWorkflow.then(step1).then(step2).then(step3).commit();
```

The output from each step is automatically passed to the next step if schemas match. If the schemas don't match, you can use the `map` function to transform the output to the expected schema.
Step chaining is type-safe and checked at compile time.

#### Parallel Execution

Execute steps in parallel using `.parallel()`:

```typescript
myWorkflow.parallel([step1, step2]).then(step3).commit();
```

This executes all steps in the array concurrently, then continues to the next step after all parallel steps complete.

You can also execute entire workflows in parallel:

```typescript
myWorkflow.parallel([nestedWorkflow1, nestedWorkflow2]).then(finalStep).commit();
```

Parallel steps receive previous step results as input. Their outputs are passed into the next step input as an object where the key is the step id and the value is the step output, for example the above example outputs an object with two keys `nestedWorkflow1` and `nestedWorkflow2` with the outputs of the respective workflows as values.

#### Conditional Branching

Create conditional branches using `.branch()`:

```typescript
myWorkflow
  .then(initialStep)
  .branch([
    [async ({ inputData }) => inputData.value > 50, highValueStep],
    [async ({ inputData }) => inputData.value <= 50, lowValueStep],
    [async ({ inputData }) => inputData.value <= 10, extremelyLowValueStep],
  ])
  .then(finalStep)
  .commit();
```

Branch conditions are evaluated sequentially, and all steps with matching conditions are executed in parallel. If `inputData.value` is `5` then both `lowValueStep` and `extremelyLowValueStep` will be run.

Each conditional step (like `highValueStep` or `lowValueStep`) receives as input the output of the previous step (`initialStep` in this case). The output of each matching conditional step is collected. The next step after the branch (`finalStep`) receives an object containing the outputs of all the steps that were run in the branch. The keys of this object are the step IDs, and the values are the outputs of those steps (`{ lowValueStep: <output of lowValueStep>, extremelyLowValueStep: <output of extremelyLowValueStep> }`).

#### Loops

vNext supports two types of loops. When looping a step (or nested workflow or any other step-compatible construct), the `inputData` of the loop is the output of the previous step initially, but any subsequent `inputData` is the output of the loop step itself. Thus for looping, the initial loop state should either match the previous step output or be derived using the `map` function.

**Do-While Loop**: Executes a step repeatedly while a condition is true.

```typescript
myWorkflow
  .dowhile(incrementStep, async ({ inputData }) => inputData.value < 10)
  .then(finalStep)
  .commit();
```

**Do-Until Loop**: Executes a step repeatedly until a condition becomes true.

```typescript
myWorkflow
  .dountil(incrementStep, async ({ inputData }) => inputData.value >= 10)
  .then(finalStep)
  .commit();
```

```typescript
const workflow = createWorkflow({
  id: 'increment-workflow',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
})
  .dountil(incrementStep, async ({ inputData }) => inputData.value >= 10)
  .then(finalStep);
```

#### Foreach

Foreach is a step that executes a step for each item in an array type input.

```typescript
const mapStep = createStep({
  id: 'map',
  description: 'Maps (+11) on the current value',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    return { value: inputData.value + 11 };
  },
});

const finalStep = createStep({
  id: 'final',
  description: 'Final step that prints the result',
  inputSchema: z.array(z.object({ value: z.number() })),
  outputSchema: z.object({
    finalValue: z.number(),
  }),
  execute: async ({ inputData }) => {
    return { finalValue: inputData.reduce((acc, curr) => acc + curr.value, 0) };
  },
});

const counterWorkflow = createWorkflow({
  steps: [mapStep, finalStep],
  id: 'counter-workflow',
  inputSchema: z.array(z.object({ value: z.number() })),
  outputSchema: z.object({
    finalValue: z.number(),
  }),
});

counterWorkflow.foreach(mapStep).then(finalStep).commit();

const run = await counterWorkflow.createRunAsync();
const result = await run.start({ inputData: [{ value: 1 }, { value: 22 }, { value: 333 }] });

if (result.status === 'success') {
  console.log(result.result); // only exists if status is success
} else if (result.status === 'failed') {
  console.error(result.error); // only exists if status is failed, this is an instance of Error
}
```

The loop executes the step for each item in the input array in sequence one at a time. The optional `concurrency` option allows you to execute steps in parallel with a limit on the number of concurrent executions.

```typescript
counterWorkflow.foreach(mapStep, { concurrency: 2 }).then(finalStep).commit();
```

#### Variable Mapping

Map specific values between steps using `.map()`:

```typescript
myWorkflow
  .then(step1)
  .map({
    transformedValue: {
      step: step1,
      path: 'nestedValue',
    },
    runtimeContextValue: {
      runtimeContextPath: 'runtimeContextValue',
      schema: z.number(),
    },
    constantValue: {
      value: 42,
      schema: z.number(),
    },
    initDataValue: {
      initData: myWorkflow,
      path: 'startValue',
    },
  })
  .then(step2)
  .commit();
```

This allows explicit mapping of values from one step's output to another step's input.

### User Interaction with Suspend/Resume

vNext workflows support pausing and resuming execution for user interaction:

```typescript
const userInputStep = createStep({
  id: 'get-user-input',
  inputSchema: z.object({}),
  resumeSchema: z.object({
    userSelection: z.string(),
  }),
  suspendSchema: z.object({
    suspendContext: z.string(),
  }),
  outputSchema: z.object({
    userSelection: z.string(),
  }),
  execute: async ({ resumeData, suspend }) => {
    if (!resumeData?.userSelection) {
      // Suspend the workflow until user provides input
      await suspend({
        suspendContext: 'Waiting for user selection',
      });
      return { userSelection: '' }; // This return is not used when suspended
    }
    // If userSelection exists, continue with it
    return { userSelection: resumeData.userSelection };
  },
});
```

```typescript
const humanInputStep = createStep({
  id: 'human-input',
  inputSchema: z.object({
    suggestions: z.array(z.string()),
    vacationDescription: z.string(),
  }),
  resumeSchema: z.object({
    selection: z.string(),
  }),
  suspendSchema: z.object({}),
  outputSchema: z.object({
    selection: z.string().describe('The selection of the user'),
    vacationDescription: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData?.selection) {
      await suspend({});
      return {
        selection: '',
        vacationDescription: inputData?.vacationDescription,
      };
    }
    return {
      selection: resumeData.selection,
      vacationDescription: inputData?.vacationDescription,
    };
  },
});
```

To resume a suspended workflow:

```typescript
// After getting user input
const result = await workflowRun.resume({
  step: userInputStep, // or 'myStepId' as a string
  resumeData: {
    userSelection: "User's choice",
  },
});
```

To resume a suspended nested workflow:

```typescript
const result = await workflowRun.resume({
  step: [nestedWorkflow, userInputStep], // or ['nestedWorkflowId', 'myStepId'] as a string array
  resumeData: {
    userSelection: "User's choice",
  },
});
```

## Running Workflows

After defining a workflow, run it with:

```typescript
// Create a run instance
const run = await myWorkflow.createRunAsync();

// Start the workflow with input data
const result = await run.start({
  inputData: {
    startValue: 'initial data',
  },
});

// Access the results
console.log(result.steps); // All step results
console.log(result.steps['step-id'].output); // Output from a specific step

if (result.status === 'success') {
  console.log(result.result); // The final result of the workflow, result of the last step (or `.map()` output, if used as last step)
} else if (result.status === 'suspended') {
  const resumeResult = await run.resume({
    step: result.suspended[0], // there is always at least one step id in the suspended array, in this case we resume the first suspended execution path
    resumeData: {
      /* user input */
    },
  });
} else if (result.status === 'failed') {
  console.error(result.error); // only exists if status is failed, this is an instance of Error
}
```

## Workflow Execution Result Schema

The result of running a workflow (either from `start()` or `resume()`) follows this TypeScript interface:

```typescript
export type WorkflowResult<...> =
  | {
      status: 'success';
      result: z.infer<TOutput>;
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown>
          : StepResult<z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>>;
      };
    }
  | {
      status: 'failed';
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown>
          : StepResult<z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>>;
      };
      error: Error;
    }
  | {
      status: 'suspended';
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown>
          : StepResult<z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>>;
      };
      suspended: [string[], ...string[][]];
    };
```

### Result Properties Explained

1. **status**: Indicates the final state of the workflow execution
   - `'success'`: Workflow completed successfully
   - `'failed'`: Workflow encountered an error
   - `'suspended'`: Workflow is paused waiting for user input

2. **result**: Contains the final output of the workflow, typed according to the workflow's `outputSchema`

3. **suspended**: Optional array of step IDs that are currently suspended. Only present when `status` is `'suspended'`

4. **steps**: A record containing the results of all executed steps
   - Keys are step IDs
   - Values are `StepResult` objects containing the step's output
   - Type-safe based on each step's `outputSchema`

5. **error**: Optional error object present when `status` is `'failed'`

### Example Usage

```typescript
const run = await workflow.createRunAsync();
const result = await run.start({
  inputData: {
    /* ... */
  },
});

if (result.status === 'success') {
  // Workflow completed successfully
  console.log('Final result:', result.result);
  console.log('Step outputs:', result.steps);
} else if (result.status === 'suspended') {
  // Workflow is waiting for user input
  console.log('Suspended steps:', result.suspended);
  // Resume the workflow with user input
  const resumedResult = await workflowRun.resume({
    step: result.suspended[0],
    resumeData: {
      /* user input */
    },
  });
} else if (result.status === 'failed') {
  // Workflow encountered an error
  console.error('Workflow failed:', result.error);
  throw result.error;
}
```

You can also watch workflow execution:

```typescript
const run = await myWorkflow.createRunAsync();

// Add a watcher to monitor execution
run.watch(event => {
  console.log('Step completed:', event.payload.currentStep.id);
});

// Start the workflow
const result = await run.start({ inputData: {...} });
```

The `event` object has the following schema:

```typescript
type WatchEvent = {
  type: 'watch';
  payload: {
    currentStep?: {
      id: string;
      status: 'running' | 'completed' | 'failed' | 'suspended';
      output?: Record<string, any>;
      payload?: Record<string, any>;
    };
    workflowState: {
      status: 'running' | 'success' | 'failed' | 'suspended';
      steps: Record<
        string,
        {
          status: 'running' | 'completed' | 'failed' | 'suspended';
          output?: Record<string, any>;
          payload?: Record<string, any>;
        }
      >;
      result?: Record<string, any>;
      error?: Record<string, any>;
      payload?: Record<string, any>;
    };
  };
  eventTimestamp: Date;
};
```

The `currentStep` property is only present when the workflow is running. When the workflow is finished the status on `workflowState` is changed, as well as the `result` and `error` properties. At the same time the `currentStep` property is removed.

## Nested Workflows

vNext supports composing workflows by nesting them:

```typescript
const nestedWorkflow = createWorkflow({
  id: 'nested-workflow',
  inputSchema: z.object({...}),
  outputSchema: z.object({...}),
})
  .then(step1)
  .then(step2)
  .commit();

const mainWorkflow = createWorkflow({
  id: 'main-workflow',
  inputSchema: z.object({...}),
  outputSchema: z.object({...}),
})
  .then(initialStep)
  .then(nestedWorkflow)
  .then(finalStep)
  .commit();
```

```typescript
const planBothWorkflow = createWorkflow({
  id: 'plan-both-workflow',
  inputSchema: forecastSchema,
  outputSchema: z.object({
    activities: z.string(),
  }),
  steps: [planActivities, planIndoorActivities, sythesizeStep],
})
  .parallel([planActivities, planIndoorActivities])
  .then(sythesizeStep)
  .commit();

const weatherWorkflow = createWorkflow({
  id: 'weather-workflow-step3-concurrency',
  inputSchema: z.object({
    city: z.string().describe('The city to get the weather for'),
  }),
  outputSchema: z.object({
    activities: z.string(),
  }),
  steps: [fetchWeather, planBothWorkflow, planActivities],
})
  .then(fetchWeather)
  .branch([
    [
      async ({ inputData }) => {
        return inputData?.precipitationChance > 20;
      },
      planBothWorkflow,
    ],
    [
      async ({ inputData }) => {
        return inputData?.precipitationChance <= 20;
      },
      planActivities,
    ],
  ]);
```

Nested workflows only have their final result (result of the last step) as their step output.

## Agent Integration

vNext workflows can use Mastra agents directly as steps using `createStep(agent)`:

```typescript
// Agent defined elsewhere
const myAgent = new Agent({
  name: 'myAgent',
  instructions: '...',
  model: openai('gpt-4'),
});

// Create Mastra instance with agent
const mastra = new Mastra({
  agents: {
    myAgent,
  },
  vnext_workflows: {
    myWorkflow,
  },
});

// Use agent in workflow
myWorkflow
  .then(preparationStep)
  .map({
    prompt: {
      step: preparationStep,
      path: 'formattedPrompt',
    },
  })
  .then(createStep(myAgent)) // Use agent directly as a step
  .then(processResultStep)
  .commit();
```

## Tools integration

vNext workflows can use Mastra tools directly as steps using `createStep(tool)`:

```typescript
const myTool = createTool({
  id: 'my-tool',
  description: 'My tool',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  execute: async ({ inputData }) => {
    return { result: 'success' };
  },
});

myWorkflow.then(createStep(myTool)).then(finalStep).commit();
```

## Differences from Original Workflow API

The vNext workflow API introduces several improvements over the original implementation. Here's how they compare:

1. **Workflow Creation Approach**:

   ```typescript
   // vNext
   import { createWorkflow, createStep } from '@mastra/core/workflows/vNext';

   const myWorkflow = createWorkflow({
     id: 'my-workflow',
     inputSchema: z.object({
       /* ... */
     }),
     outputSchema: z.object({
       /* ... */
     }),
   })
     .then(step1)
     .then(step2)
     .commit();

   // Original Mastra API
   import { Workflow, Step } from '@mastra/core/workflows';

   const workflow = new Workflow({
     name: 'test-workflow',
   })
     .step(step1)
     .then(step2)
     .commit();
   ```

   The vNext API uses functional creation patterns with `createWorkflow` and `createStep` rather than class-based instantiation.

2. **Step Definition**:

   ```typescript
   // vNext
   const myStep = createStep({
     id: 'my-step',
     inputSchema: z.object({
       /* ... */
     }),
     outputSchema: z.object({
       /* ... */
     }),
     execute: async ({ inputData }) => {
       // Logic here
       return { result: 'success' };
     },
   });

   // Original Mastra API
   const myStep = new Step({
     id: 'my-step',
     execute: async ({ context }) => {
       // Logic with different access pattern
       return { result: 'success' };
     },
   });
   ```

   The vNext API emphasizes schema validation with explicit input and output schemas for each step, as well as type-safe step chaining with default inputs.

3. **Context & Data Access**:

   ```typescript
   // vNext execute function
   execute: async ({ inputData, getStepResult, getInitData }) => {
     const previousStepOutput = getStepResult(step1);
     const initDataAny = getInitData(); // typed as any
     const initDataTyped = getInitData<typeof inputSchema>(); // typed as the input schema
     const initDataTyped = getInitData<typeof workflow>(); // typed as the workflow input schema
     return {
       /* ... */
     };
   };

   // Original Mastra API
   execute: async ({ context }) => {
     const previousStepOutput = context.getStepResult('step1');
     const initDataAny = context.getStepResult('trigger'); // typed as any
     const initDataTyped = context.getStepResult<{ myTriggerData: string }>('trigger'); // typed as the workflow input schema
     return {
       /* ... */
     };
   };
   ```

   The vNext API provides direct parameter access rather than requiring a context object. The only way to access previous step results, other than the previous step (or `.map()` output), is to use the `getStepResult` function, which only takes a step reference as argument for type safety.

4. **Conditional Branching**:

   ```typescript
   // vNext - array-based branching
   workflow.branch([
     [async ({ inputData }) => inputData.value > 50, highValueStep],
     [async ({ inputData }) => inputData.value <= 50, lowValueStep],
   ]);

   // Original Mastra API - when-based conditions
   workflow
     .then(step2, {
       id: 'step2',
       when: {
         ref: { step: step1, path: 'status' },
         query: { $eq: 'success' },
       },
     })
     .then(step3, {
       id: 'step3',
       when: {
         ref: { step: step1, path: 'status' },
         query: { $eq: 'failed' },
       },
     });
   ```

   The vNext API provides a dedicated branching mechanism for clearer decision paths. This makes branching more visually explicit and clear, compared to when conditions or `.if()` constructs.

5. **Loop Control Structures**:

   ```typescript
   // vNext - specialized loop constructs
   workflow.dowhile(incrementStep, async ({ inputData }) => inputData.value < 10).then(finalStep);

   workflow.dountil(incrementStep, async ({ inputData }) => inputData.value >= 10).then(finalStep);

   // Original Mastra API
   workflow
     .while(async ({ context }) => {
       const res = context.getStepResult('increment');
       return (res?.newValue ?? 0) < 10;
     }, incrementStep)
     .then(finalStep);

   workflow
     .until(async ({ context }) => {
       const res = context.getStepResult('increment');
       return (res?.newValue ?? 0) >= 10;
     }, incrementStep)
     .then(finalStep);
   ```

   The vNext API provides dedicated loop constructs for clearer control flow. It repeats the provided step or nested workflow instead of looping back in the existing execution flow.

6. **Parallel Execution**:

   ```typescript
   // vNext - explicit parallel
   workflow.parallel([step1, step2]);

   // Original Mastra API - implicit parallel
   workflow.step(step1).step(step2).after([step1, step2]);
   ```

   In vNext, parallel execution is explicit through the `parallel` method, while in the original API, steps added with `.step()` run in parallel by default. There is no more `.after()` method.

7. **Data Mapping**:

   ```typescript
   // vNext - dedicated map function
   workflow
     .then(step1)
     .map({
       transformedValue: {
         step: step1,
         path: 'output.nestedValue',
       },
     })
     .then(step2);

   // Original Mastra API - variables in step options
   workflow.step(step1).then(step2, {
     id: 'step2',
     variables: {
       transformedValue: { step: step1, path: 'nested.value' },
     },
   });
   ```

   The vNext API introduces a dedicated `map` method for clearer data transformation.

8. **Suspend and Resume Operations**:

   ```typescript
   // vNext
   const result = await run.resume({
     step: userInputStep,
     resumeData: { userSelection: 'User choice' },
   });

   // Original Mastra API
   const result = await run.resume({
     stepId: 'humanIntervention',
     context: {
       humanPrompt: 'What improvements would you suggest?',
     },
   });
   ```

   Both APIs support workflow suspension and resumption but with different parameter structures.

9. **Workflow Execution**:

   ```typescript
   // vNext
   const run = await workflow.createRunAsync();
   const result = await run.start({ inputData: { data: 'value' } });

   // Original Mastra API
   const run = await workflow.createRunAsync();
   const result = await run.start({ triggerData: { data: 'value' } });
   ```

   vNext uses `inputData` terminology for consistency with step execution parameters.

10. **Removed features**: The original API includes some features not currently implemented in vNext:

    ```typescript
    // Event-driven execution (Original API)
    workflow.step(getUserInput).afterEvent('testev').step(promptAgent);

    // Subscriber pattern via `.after()` (Original API)
    workflow.step(step1).then(step2).after(step1).step(step3);
    ```

    The original API has direct support for event-driven steps and the subscriber pattern.

    Event-driven architectures will be re-thought and re-implemented in the future.

## Examples

### Basic Sequential Workflow

```typescript
const weatherWorkflow = createWorkflow({
  steps: [fetchWeather, planActivities],
  id: 'weather-workflow-step1-single-day',
  inputSchema: z.object({
    city: z.string().describe('The city to get the weather for'),
  }),
  outputSchema: z.object({
    activities: z.string(),
  }),
})
  .then(fetchWeather)
  .then(planActivities);

weatherWorkflow.commit();
```

### Conditional Branching Workflow

```typescript
const weatherWorkflow = createWorkflow({
  id: 'weather-workflow-step2-if-else',
  inputSchema: z.object({
    city: z.string().describe('The city to get the weather for'),
  }),
  outputSchema: z.object({
    activities: z.string(),
  }),
})
  .then(fetchWeather)
  .branch([
    [
      async ({ inputData }) => {
        return inputData?.precipitationChance > 50;
      },
      planIndoorActivities,
    ],
    [
      async ({ inputData }) => {
        return inputData?.precipitationChance <= 50;
      },
      planActivities,
    ],
  ]);

weatherWorkflow.commit();
```

### User Interaction Workflow

```typescript
import { createWorkflow, createStep } from '@mastra/core/workflows/vNext';

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
  execute: async ({ inputData, mastra }) => {
    if (!mastra) {
      throw new Error('Mastra is not initialized');
    }

    const { vacationDescription } = inputData;
    const result = await mastra.getAgent('summaryTravelAgent').generate([
      {
        role: 'user',
        content: vacationDescription,
      },
    ]);
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
  execute: async ({ inputData, resumeData, suspend }) => {
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
```

### Loop Workflow

```typescript
const workflow = createWorkflow({
  id: 'increment-workflow',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
})
  .dountil(incrementStep, async ({ inputData }) => inputData.value >= 10)
  .then(finalStep);

workflow.commit();
```

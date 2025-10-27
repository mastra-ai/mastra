---
title: "Overview"
description: "Workflows in Mastra help you orchestrate complex sequences of tasks with features like branching, parallel execution, resource suspension, and more."
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Workflows overview

Workflows let you define complex sequences of tasks using clear, structured steps rather than relying on the reasoning of a single agent. They give you full control over how tasks are broken down, how data moves between them, and what gets executed when.

![Workflows overview](/img/workflows/workflows-overview.jpg)

## When to use workflows

Use workflows for tasks that are clearly defined upfront and involve multiple steps with a specific execution order. They give you fine-grained control over how data flows and transforms between steps, and which primitives are called at each stage.

> **📹 Watch**: → An introduction to workflows, and how they compare to agents [YouTube (7 minutes)](https://youtu.be/0jg2g3sNvgw)

## Core principles

Mastra workflows operate using these principles:

- Defining **steps** with `createStep`, specifying input/output schemas and business logic.
- Composing **steps** with `createWorkflow` to define the execution flow.
- Running **workflows** to execute the entire sequence, with built-in support for suspension, resumption, and streaming results.

## Creating a workflow step

Steps are the building blocks of workflows. Create a step using `createStep()` with `inputSchema` and `outputSchema` to define the data it accepts and returns.

The `execute` function defines what the step does. Use it to call functions in your codebase, external APIs, agents, or tools.

```typescript {6,9,15} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createStep } from "@mastra/core/workflows";

const step1 = createStep({
  id: "step-1",
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    formatted: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { message } = inputData;

    return {
      formatted: message.toUpperCase(),
    };
  },
});
```

> See the [Step Class](../../reference/workflows/step.mdx) for a full list of configuration options.

### Using agents and tools

Workflow steps can also call registered agents or import and execute tools directly, visit the [Agents and Tools](./agents-and-tools.mdx) page for more information.

## Creating a workflow

Create a workflow using `createWorkflow()` with `inputSchema` and `outputSchema` to define the data it accepts and returns. Add steps using `.then()` and complete the workflow with `.commit()`.

```typescript {9,12,15,16} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});

export const testWorkflow = createWorkflow({
  id: "test-workflow",
  inputSchema: z.object({
    message: z.string()
  }),
  outputSchema: z.object({
    output: z.string()
  })
})
  .then(step1)
  .commit();

```

> See the [Workflow Class](../../reference/workflows/workflow.mdx) for a full list of configuration options.

### Understanding control flow

Workflows can be composed using a number of different methods. The method you choose determines how each step's schema should be structured. Visit the [Control Flow](./control-flow.mdx) page for more information.

#### Composing workflow steps

When using `.then()`, steps run sequentially. Each step’s `inputSchema` must match the `outputSchema` of the previous step. The final step’s `outputSchema` should match the workflow’s `outputSchema` to ensure end-to-end type safety.

```typescript {12,28,39} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
const step1 = createStep({
  id: "step-1",
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    formatted: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { message } = inputData;
    return {
      formatted: message.toUpperCase(),
    };
  },
});

const step2 = createStep({
  id: "step-2",
  inputSchema: z.object({
    formatted: z.string(),
  }),
  outputSchema: z.object({
    emphasized: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { formatted } = inputData;
    return {
      emphasized: `${formatted}!!!`,
    };
  },
});

export const testWorkflow = createWorkflow({
  id: "test-workflow",
  inputSchema: z.object({
    message: z.string(),
  }),
  outputSchema: z.object({
    emphasized: z.string(),
  }),
})
  .then(step1)
  .then(step2)
  .commit();
```

### Workflow state

Workflow state lets you share values across steps without passing them through every step’s `inputSchema` and `outputSchema`. All state values are defined in the workflow’s `stateSchema`, but each step only declares the values it needs. To set initial values, use `initialState` when running the workflow. See [Running workflows](#running-workflows) for details.

```typescript filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
const step1 = createStep({
  // ...
  stateSchema: z.object({
    processedItems: z.array(z.string()),
  }),
  execute: async ({ inputData, state, setState }) => {
    const { message } = inputData;
    const { processedItems } = state;

    setState({
      ...state,
      processedItems: [...processedItems, "item-1", "item-2"],
    });

    return {
      formatted: message.toUpperCase(),
    };
  },
});

const step2 = createStep({
  // ...
  stateSchema: z.object({
    metadata: z.object({
      processedBy: z.string(),
    }),
  }),
  execute: async ({ inputData, state }) => {
    const { formatted } = inputData;
    const { metadata } = state;

    return {
      emphasized: `${formatted}!! ${metadata.processedBy}`,
    };
  },
});

export const testWorkflow = createWorkflow({
  // ...
  stateSchema: z.object({
    processedItems: z.array(z.string()),
    metadata: z.object({
      processedBy: z.string(),
    }),
  }),
})
  .then(step1)
  .then(step2)
  .commit();
```

:::note
Workflow state is currently supported only when using [Run.start()](../../reference/workflows/run-methods/start.mdx). Support for `Run.stream()` will be added soon.
:::

### Registering a workflow

Register your workflow in the Mastra instance to make it available throughout your application. Once registered, it can be called from agents or tools and has access to shared resources such as logging and observability features:

```typescript {6} filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from "@mastra/core/mastra";
import { testWorkflow } from "./workflows/test-workflow";

export const mastra = new Mastra({
  // ...
  workflows: { testWorkflow },
});
```

## Referencing a workflow

You can run workflows from agents, tools, the Mastra Client, or the command line. Get a reference by calling `.getWorkflow()` on your `mastra` or `mastraClient` instance, depending on your setup:

```typescript showLineNumbers copy
const testWorkflow = mastra.getWorkflow("testWorkflow");
```

:::note
`mastra.getWorkflow()` is preferred over a direct import, since it provides access to the Mastra instance configuration (logger, telemetry, storage, registered agents, and vector stores).
:::

> See [Running Workflows](../../examples/workflows/running-workflows.mdx) for more information.

## Running workflows

Workflows can be run in two modes: start waits for all steps to complete before returning, and stream emits events during execution. Choose the approach that fits your use case: start when you only need the final result, and stream when you want to monitor progress or trigger actions as steps complete.

<Tabs>
<TabItem value="start" label="Start" default>
Create a workflow run with `createRunAsync()`, then call `.start()` with `inputData` matching the workflow’s `inputSchema`. If you’re using workflow state, include `initialState` alongside `inputData`. The workflow runs all steps and returns the final result.

To return state values in the result, set `includeState: true` in `outputOptions`.

```typescript showLineNumbers copy
const run = await testWorkflow.createRunAsync();

const result = await run.start({
  inputData: {
    message: "Hello world",
  },
  initialState: {
    processedItems: [],
    metadata: {
      processedBy: "ADMIN",
    },
  },
  outputOptions: {
    includeState: true,
  },
});

console.log(result);
```

> See [Run.start()](../../reference/workflows/run-methods/start.mdx) for a full list of configuration options.

</TabItem>
<TabItem value="stream" label="Stream">
Create a workflow run with `createRunAsync()`, then call `.stream()` with `inputData` matching the workflow’s `inputSchema`. The workflow emits events as steps run, allowing you to monitor progress as it happens.

```typescript showLineNumbers copy
const run = await testWorkflow.createRunAsync();

const result = await run.stream({
  inputData: {
    message: "Hello world",
  },
});

for await (const chunk of result.stream) {
  console.log(chunk);
}
```

> See [Run.stream()](../../reference/streaming/workflows/stream.mdx) for a full list of configuration options.

</TabItem>
</Tabs>

## Workflow output

The workflow output includes the full execution lifecycle, showing the input and output for each step. It also includes the status of each step, the overall workflow status, and the final result. This gives you clear insight into how data moved through the workflow, what each step produced, and how the workflow completed.

```json
{
  "status": "success",
  "steps": {
    // ...
    "step-1": {
      "status": "success",
      "payload": {
        "message": "Hello world"
      },
      "output": {
        "formatted": "HELLO WORLD"
      }
    },
    "step-2": {
      "status": "success",
      "payload": {
        "formatted": "HELLO WORLD"
      },
      "output": {
        "emphasized": "HELLO WORLD!!!"
      }
    }
  },
  "input": {
    "message": "Hello world"
  },
  "result": {
    "emphasized": "HELLO WORLD!!!"
  }
}
```

## Using `RuntimeContext`

Use [RuntimeContext](../server-db/runtime-context.mdx) to access request-specific values. This lets you conditionally adjust behavior based on the context of the request.

```typescript filename="src/mastra/workflows/test-workflow.ts" showLineNumbers
export type UserTier = {
  "user-tier": "enterprise" | "pro";
};

const step1 = createStep({
  // ...
  execute: async ({ runtimeContext }) => {
    const userTier = runtimeContext.get("user-tier") as UserTier["user-tier"];

    const maxResults = userTier === "enterprise" ? 1000 : 50;

    return { maxResults };
  },
});
```

> See [Runtime Context](../server-db/runtime-context.mdx) for more information.

## Testing with Mastra Playground

Use the Mastra [Playground](../server-db/local-dev-playground.mdx) to easily run workflows with different inputs, visualize the execution lifecycle, see the inputs and outputs for each step, and inspect each part of the workflow in more detail.

## Related

For a closer look at workflows, see our [Workflow Guide](../../guides/guide/ai-recruiter.mdx), which walks through the core concepts with a practical example.

- [Parallel Steps workflow example](../../examples/workflows/parallel-steps.mdx)
- [Conditional Branching workflow example](../../examples/workflows/conditional-branching.mdx)
- [Inngest workflow example](../../examples/workflows/inngest-workflow.mdx)
- [Suspend and Resume workflow example](../../examples/workflows/human-in-the-loop.mdx)

## Workflows (Legacy)

For legacy workflow documentation, see [Workflows (Legacy)](../workflows-legacy/overview.mdx).

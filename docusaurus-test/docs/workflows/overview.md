---
title: "Handling Complex LLM Operations "
description: "Workflows in Mastra help you orchestrate complex sequences of tasks with features like branching, parallel execution, resource suspension, and more."
---

# Workflows overview

Workflows allow you to define and manage complex sequences of tasks by connecting them with clear, structured processes. Unlike a single agent, which operates independently, workflows enable you to orchestrate multiple steps with specific logic, tools, and external services. This approach provides more control and predictability, ensuring consistent results by allowing you to determine what tasks are performed and when they are completed.

![Workflows overview](/img/workflows/workflows-overview.jpg)

## When to use a workflow

For example, you might want to perform a sequence of tasks:

1. Handle a user question like “Can I return my last order?”
2. Fetch user-specific data from a database using their `user_id`.
3. Check return eligibility via an external API or business logic.
4. Make a conditional decision (e.g. approve, deny, escalate) based on the data.
5. Generate a tailored response based on the outcome.

Each of these tasks is created as a **step** in a workflow, giving you fine-grained control over data flow, execution order, and side effects.

> **📹 Watch**:  → An introduction to workflows, and how they compare to agents [YouTube (7 minutes)](https://youtu.be/0jg2g3sNvgw)

## Building workflows

You create workflows by:

- Defining **steps** with `createStep`, specifying input/output schemas and business logic.
- Composing **steps** with `createWorkflow` to define the execution flow.
- Running **workflows** to execute the entire sequence, with built-in support for suspension, resumption, and streaming results.

This structure provides full type safety and runtime validation, ensuring data integrity across the entire workflow.

### Visual testing

Use the [Playground](../server-db/local-dev-playground.mdx#workflows) to visualize workflow execution in real time. It shows which steps are running, completed, or suspended.


## Getting started

To use workflows, install the required dependencies:

```bash
npm install @mastra/core
```

Import the necessary functions from the `workflows` subpath:

```typescript filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
```

### Create step

Steps are the building blocks of workflows. Create a step using `createStep`:

```typescript filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
const step1 = createStep({...});
```

> See [createStep](../../reference/workflows/step.md) for more information.

### Create workflow

Create a workflow using `createWorkflow` and complete it with `.commit()`.

```typescript {6,17} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});

export const testWorkflow = createWorkflow({
  id: "test-workflow",
  description: 'Test workflow',
  inputSchema: z.object({
    input: z.string()
  }),
  outputSchema: z.object({
    output: z.string()
  })
})
  .then(step1)
  .commit();
```

> See [workflow](../../reference/workflows/workflow.md) for more information.

#### Composing steps

Workflow steps can be composed and executed sequentially using `.then()`.

```typescript {17,18} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});
const step2 = createStep({...});

export const testWorkflow = createWorkflow({
  id: "test-workflow",
  description: 'Test workflow',
  inputSchema: z.object({
    input: z.string()
  }),
  outputSchema: z.object({
    output: z.string()
  })
})
  .then(step1)
  .then(step2)
  .commit();
```

> Steps can be composed using a number of different methods. See [Control Flow](./control-flow.md)  for more information.

#### Cloning steps

Workflow steps can be cloned using `cloneStep()`, and used with any workflow method.

```typescript {5,19} filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow, createStep, cloneStep } from "@mastra/core/workflows";
import { z } from "zod";

const step1 = createStep({...});
const clonedStep = cloneStep(step1, { id: "cloned-step" });
const step2 = createStep({...});

export const testWorkflow = createWorkflow({
  id: "test-workflow",
  description: 'Test workflow',
  inputSchema: z.object({
    input: z.string()
  }),
  outputSchema: z.object({
    output: z.string()
  })
})
  .then(step1)
  .then(clonedStep)
  .then(step2)
  .commit();
```

## Register workflow

Register a workflow using `workflows` in the main Mastra instance:

```typescript {8} filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";

import { testWorkflow } from "./workflows/test-workflow";

export const mastra = new Mastra({
  workflows: { testWorkflow },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:"
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info"
  })
});
```

## Testing workflows locally
There are two ways to run and test workflows.



### Mastra Playground

With the Mastra Dev Server running you can run the workflow from the Mastra Playground by visiting [http://localhost:4111/workflows](http://localhost:4111/workflows) in your browser.

> For more information, see the [Local Dev Playground](../server-db/local-dev-playground.md) documentation.

### Command line

Create a workflow run instance using `createRunAsync` and `start`:

```typescript {3,5} filename="src/test-workflow.ts" showLineNumbers copy
import "dotenv/config";

import { mastra } from "./mastra";

const run = await mastra.getWorkflow("testWorkflow").createRunAsync();

const result = await run.start({
  inputData: {
    city: "London"
  }
});

console.log(result);

if (result.status === 'success') {
  console.log(result.result.output);
}
```
> see [createRunAsync](../../reference/workflows/run.md) and [start](../../reference/workflows/run-methods/start.md) for more information.

To trigger this workflow, run the following:

```bash copy
npx tsx src/test-workflow.ts
```



### Run workflow results

The result of running a workflow using either `start()` or `resume()` will look like one of the following, depending on the outcome.

#### Status success

```json
{
  "status": "success",
  "steps": {
    // ...
    "step-1": {
      // ...
      "status": "success",
    }
  },
  "result": {
    "output": "London + step-1"
  }
}
```

- **status**: Shows the final state of the workflow execution, either: `success`, `suspended`, or `error`
- **steps**: Lists each step in the workflow, including inputs and outputs
- **status**: Shows the outcome of each individual step
- **result**: Includes the final output of the workflow, typed according to the `outputSchema`


#### Status suspended

```json
{
  "status": "suspended",
  "steps": {
    // ...
    "step-1": {
      // ...
      "status": "suspended",
    }
  },
  "suspended": [
    [
      "step-1"
    ]
  ]
}
```

- **suspended**: An optional array listing any steps currently awaiting input before continuing

#### Status failed

```json
{
  "status": "failed",
  "steps": {
    // ...
    "step-1": {
      // ...
      "status": "failed",
      "error": "Test error",
    }
  },
  "error": "Test error"
}
```
- **error**: An optional field that includes the error message if the workflow fails

## Stream workflow

Similar to the run method shown above, workflows can also be streamed:

```typescript {5} filename="src/test-workflow.ts" showLineNumbers copy
import { mastra } from "./mastra";

const run = await mastra.getWorkflow("testWorkflow").createRunAsync();

const result = await run.stream({
  inputData: {
    city: "London"
  }
});

for await (const chunk of result.stream) {
  console.log(chunk);
}
```

> See [stream](../../reference/workflows/run-methods/stream.md) for more information.

## Watch Workflow

A workflow can also be watched, allowing you to inspect each event that is emitted.

```typescript {5} filename="src/test-workflow.ts" showLineNumbers copy
import { mastra } from "./mastra";

const run = await mastra.getWorkflow("testWorkflow").createRunAsync();

run.watch((event) => {
  console.log(event);
});

const result = await run.start({
  inputData: {
    city: "London"
  }
});
```

> See [watch](../../reference/workflows/run-methods/watch.md) for more information.

## Related

- The [Workflow Guide](../../guides/guide/ai-recruiter.md) in the Guides section is a tutorial that covers the main concepts.
- [Parallel Steps workflow example](../../examples/workflows/parallel-steps.md)
- [Conditional Branching workflow example](../../examples/workflows/conditional-branching.md)
- [Inngest workflow example](../../examples/workflows/inngest-workflow.md)
- [Suspend and Resume workflow example](../../examples/workflows/human-in-the-loop.md)


## Workflows (Legacy)

For legacy workflow documentation, see [Workflows (Legacy)](../workflows-legacy/overview.md).


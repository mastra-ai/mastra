# Mastra vNext Agent Network

The vNext Agent Network module introduces a flexible, composable and non-deterministic way to orchestrate multiple specialized agents and workflows, enabling complex, reasoning and task completion.

There are two main problem areas that this system is designed to solve:

- Scenarios where a single agent is insufficient, and tasks require collaboration, routing, or sequential/parallel execution across multiple agents and workflows.
- Scenarios where the task is not fully defined and is initiated with unstructured input. The AgentNetwork can figure out which primitive to call and turn unstructured input into a structured task.

## Differences from Workflows

- Workflows are linear or branched sequences of steps. This creates a deterministic flow of execution.
- Agent Networks add a layer of non-deterministic LLM-based orchestration, allowing dynamic, multi-agent collaboration and routing. This creates a non-deterministic flow of execution.

## Differences from current experimental implementation

- The current implementation of AgentNetwork relies on tool calls to call other agents in the network. The vNext implementation is using Mastra workflows under the hood to break down the execution to individual tasks.
- New methods, `.generate()` for a one-off "playbook"-like execution of a single primitive in the network, more suitable for a chat-based interface where you iterate on a solution. The `.loop()` method is still available for more complex tasks and operates much like the current implementation.

## Important details

- Providing memory to the AgentNetwork is _not_ optional when using the `loop` method, as it is required to store the task history. Memory is the core primitive used for any decisions on which primitives to run, as well as determine task completion.
- Any available primitives (agents, workflows) are used based on their descriptions. The better the description, the better the routing agent will be able to select the right primitive. For workflows, the input schema is also used to determine which inputs to use when calling the workflow. More descriptive naming yields better results.
- When primitives with overlapping capabilities are available, the routing agent will use the most specific primitive. For example, if both an agent and a workflow can do research, it will use the input schema of the worklfow to determine

## Unstructured input to structured task

As an example, we have an AgentNetwork with 3 primitives at its disposal:

- `agent1`: A general research agent that can do research on a given topic.
- `agent2`: A general writing agent that can write a full report based on the researched material.
- `workflow1`: A workflow that can research a given city and write a full report based on the researched material (using both agent1 and agent2).

The AgentNetwork is able to route the task to the most appropriate primitive based on the task and the context.
To ask the AgentNetwork to act on unstructured (text) input, we can use the `generate` method.

```typescript
import { NewAgentNetwork } from '@mastra/core/network/vNext';
import { Agent } from '@mastra/core/agent';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { Memory } from '@mastra/memory';
import { openai } from '@ai-sdk/openai';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';
import { RuntimeContext } from '@mastra/core/runtime-context';

const memory = new Memory({
  storage: new LibSQLStore({
    url: 'file:../mastra.db', // Or your database URL
  }),
});

const agent1 = new Agent({
  name: 'agent1',
  instructions:
    'This agent is used to do research, but not create full responses. Answer in bullet points only and be concise.',
  description:
    'This agent is used to do research, but not create full responses. Answer in bullet points only and be concise.',
  model: openai('gpt-4o'),
});

const agent2 = new Agent({
  name: 'agent2',
  description: 'This agent is used to do text synthesis on researched material. It writes articles in full paragraphs.',
  instructions:
    'This agent is used to do text synthesis on researched material. Write a full report based on the researched material. Do not use bullet points. Write full paragraphs. There should not be a single bullet point in the final report. You write articles.',
  model: openai('gpt-4o'),
});

const agentStep1 = createStep({
  id: 'agent-step',
  description: 'This step is used to do research and text synthesis.',
  inputSchema: z.object({
    city: z.string().describe('The city to research'),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
  execute: async ({ inputData }) => {
    const resp = await agent1.generate(inputData.city, {
      output: z.object({
        text: z.string(),
      }),
    });

    return { text: resp.object.text };
  },
});

const agentStep2 = createStep({
  id: 'agent-step-two',
  description: 'This step is used to do research and text synthesis.',
  inputSchema: z.object({
    text: z.string().describe('The city to research'),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
  execute: async ({ inputData }) => {
    const resp = await agent2.generate(inputData.text, {
      output: z.object({
        text: z.string(),
      }),
    });

    return { text: resp.object.text };
  },
});

const workflow1 = createWorkflow({
  id: 'workflow1',
  description: 'This workflow is perfect for researching a specific city.',
  steps: [],
  inputSchema: z.object({
    city: z.string(),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
})
  .then(agentStep1)
  .then(agentStep2)
  .commit();

const network = new NewAgentNetwork({
  id: 'test-network',
  name: 'Test Network',
  instructions:
    'You can research cities. You can also synthesize research material. You can also write a full report based on the researched material.',
  model: openai('gpt-4o'),
  agents: {
    agent1,
    agent2,
  },
  workflows: {
    workflow1,
  },
  memory: memory,
});

const runtimeContext = new RuntimeContext();

// This will call agent1, as the workflow is meant to be used with individual cities. The best primitive according to the routing agent is thus agent1 which is a general research primitive.
console.log(await network.generate('What are the biggest cities in France? How are they like?', { runtimeContext }));
// This will call workflow1, as it is the most suitable primitive according to the routing agent when researching individual cities.
console.log(await network.generate('Tell me more about Paris', { runtimeContext }));
```

The AgentNetwork will call the most appropriate primitive based on the task and the context. In the case of researching specific cities, it can figure out how to turn unstructured input into structured workflow inputs based on the workflow's input schema and description. It also knows, that for any other research topic, `agent1` is likely the most appropriate primitive.

### How It Works

- The underlying engine is a Mastra workflow.
- As a first step, the network uses a **routing agent** to decide which agent or workflow should handle each step.
- The routing agent will generate a prompt and or structured input for the selected primitive.
- The next step in the workflow is a `.branch()` that will select the right primitive, calling either an agent step or a workflow step with the input generated by the routing agent.

## Complex tasks requiring multiple primitives

As an example, we have an AgentNetwork with 3 primitives at its disposal:

- `agent1`: A general research agent that can do research on a given topic.
- `agent2`: A general writing agent that can write a full report based on the researched material.
- `workflow1`: A workflow that can research a given city and write a full report based on the researched material (using both agent1 and agent2).

We use the `loop` method to create a task that requires multiple primitives. The AgentNetwork will, using memory, figure out which primitives to call and in which order, as well as when the task is complete.

```typescript
import { NewAgentNetwork } from '@mastra/core/network/vNext';
import { Agent } from '@mastra/core/agent';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { Memory } from '@mastra/memory';
import { openai } from '@ai-sdk/openai';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';
import { RuntimeContext } from '@mastra/core/runtime-context';

const memory = new Memory({
  storage: new LibSQLStore({
    url: 'file:../mastra.db', // Or your database URL
  }),
});

const agentStep1 = createStep({
  id: 'agent-step',
  description: 'This step is used to do research and text synthesis.',
  inputSchema: z.object({
    city: z.string().describe('The city to research'),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
  execute: async ({ inputData }) => {
    const resp = await agent1.generate(inputData.city, {
      output: z.object({
        text: z.string(),
      }),
    });

    return { text: resp.object.text };
  },
});

const agentStep2 = createStep({
  id: 'agent-step-two',
  description: 'This step is used to do research and text synthesis.',
  inputSchema: z.object({
    text: z.string().describe('The city to research'),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
  execute: async ({ inputData }) => {
    const resp = await agent2.generate(inputData.text, {
      output: z.object({
        text: z.string(),
      }),
    });

    return { text: resp.object.text };
  },
});

const workflow1 = createWorkflow({
  id: 'workflow1',
  description:
    'This workflow is perfect for researching a specific city. It should be used when you have a city in mind to research.',
  steps: [],
  inputSchema: z.object({
    city: z.string(),
  }),
  outputSchema: z.object({
    text: z.string(),
  }),
})
  .then(agentStep1)
  .then(agentStep2)
  .commit();

const agent1 = new Agent({
  name: 'agent1',
  instructions:
    'This agent is used to do research, but not create full responses. Answer in bullet points only and be concise.',
  description:
    'This agent is used to do research, but not create full responses. Answer in bullet points only and be concise.',
  model: openai('gpt-4o'),
});

const agent2 = new Agent({
  name: 'agent2',
  description:
    'This agent is used to do text synthesis on researched material. Write a full report based on the researched material. Writes reports in full paragraphs. Should be used to synthesize text from different sources together as a final report.',
  instructions:
    'This agent is used to do text synthesis on researched material. Write a full report based on the researched material. Do not use bullet points. Write full paragraphs. There should not be a single bullet point in the final report.',
  model: openai('gpt-4o'),
});

const network = new NewAgentNetwork({
  id: 'test-network',
  name: 'Test Network',
  instructions:
    'You are a network of writers and researchers. The user will ask you to research a topic. You always need to answer with a full report. Bullet points are NOT a full report. WRITE FULL PARAGRAPHS like this is a blog post or something similar. You should not rely on partial information.',
  model: openai('gpt-4o'),
  agents: {
    agent1,
    agent2,
  },
  workflows: {
    workflow1,
  },
  memory: memory,
});

const runtimeContext = new RuntimeContext();

console.log(
  // specifying the task, note that there is a mention here about using an agent for synthesis. This is because the routing agent can actually do some synthesis on results on its own, so this will force it to use agent2 instead
  await network.loop(
    'What are the biggest cities in France? Give me 3. How are they like? Find cities, then do thorough research on each city, and give me a final full report synthesizing all that information. Make sure to use an agent for synthesis.',
    { runtimeContext },
  ),
);
```

For the given task (research 3 biggest cities in France and write a full report), the AgentNetwork will call the following primitives:

1. `agent1` to find the 3 biggest cities in France.
2. `workflow1` to research each city one by one. The workflow uses `memory` to figure out which cities have already been researched and makes sure it has researched all of them before proceeding.
3. `agent2` to synthesize the final report.

### How It Works

- The underlying engine is a Mastra workflow that wraps the single call `generate` workflow.
- The workflow will repeatedly call the network execution workflow with a `dountil` structure, until the routing model determines the task is complete. This check is used as the `dountil` condition.

## Registering the network in Mastra

```typescript
const mastra = new Mastra({
  vnext_networks: {
    'test-network': network,
  },
});

// using the network
const network = mastra.vnext_getNetwork('test-network');

if (!network) {
  throw new Error('Network not found');
}

console.log(await network.generate('What are the biggest cities in France?', { runtimeContext }));
```

## Using @mastra/client-js

You can use the `@mastra/client-js` package to run the network from the client side.

```typescript
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient();

const network = client.getVNextNetwork('test-network');

console.log(await network.generate('What are the biggest cities in France?', { runtimeContext }));
```

You can also stream the response

```typescript
const stream = await network.stream('What are the biggest cities in France?', { runtimeContext });

for await (const chunk of stream) {
  console.log(chunk);
}
```

And for loops

```typescript
console.log(
  // specifying the task, note that there is a mention here about using an agent for synthesis. This is because the routing agent can actually do some synthesis on results on its own, so this will force it to use agent2 instead
  await network.loop(
    'What are the biggest cities in France? Give me 3. How are they like? Find cities, then do thorough research on each city, and give me a final full report synthesizing all that information. Make sure to use an agent for synthesis.',
    { runtimeContext },
  ),
);
```

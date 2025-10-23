---
title: 'Overview'
description: Overview of agents in Mastra, detailing their capabilities and how they interact with tools, workflows, and external systems.
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Using Agents

Agents use LLMs and tools to solve open-ended tasks. They reason about goals, decide which tools to use, retain conversation memory, and iterate internally until the model emits a final answer or an optional stop condition is met. Agents produce structured responses you can render in your UI or process programmatically. Use agents directly or compose them into workflows or agent networks.

![Agents overview](/img/agents/agents-overview.jpg)

> **📹 Watch**: → An introduction to agents, and how they compare to workflows [YouTube (7 minutes)](https://youtu.be/0jg2g3sNvgw)

## Getting started

<Tabs>
  <TabItem value="mastra-router" label="Mastra model router">
    
### Install dependencies

Add the Mastra core package to your project:

```bash
npm install @mastra/core
```

### Set your API key

Mastra's model router auto-detects environment variables for your chosen provider. For OpenAI, set `OPENAI_API_KEY`:

```bash filename=".env" copy
OPENAI_API_KEY=<your-api-key>
```

> Mastra supports more than 600 models. Choose from the full list [here](/docs/models).

### Create an agent

Create an agent by instantiating the `Agent` class with system `instructions` and a `model`:

```typescript filename="src/mastra/agents/test-agent.ts" showLineNumbers copy
import { Agent } from '@mastra/core/agent';

export const testAgent = new Agent({
  name: 'test-agent',
  instructions: 'You are a helpful assistant.',
  model: 'openai/gpt-4o-mini',
});
```

  </TabItem>
  <TabItem value="vercel-ai-sdk" label="Vercel AI SDK">

### Install dependencies

Include the Mastra core package alongside the Vercel AI SDK provider you want to use:

```bash
npm install @mastra/core @ai-sdk/openai
```

### Set your API key

Set the corresponding environment variable for your provider. For OpenAI via the AI SDK:

```bash filename=".env" copy
OPENAI_API_KEY=<your-api-key>
```

> See the [AI SDK Providers](https://ai-sdk.dev/providers/ai-sdk-providers) in the Vercel AI SDK docs for additional configuration options.

### Create an agent

To create an agent in Mastra, use the `Agent` class. Every agent must include `instructions` to define its behavior, and a `model` parameter to specify the LLM provider and model. When using the Vercel AI SDK, provide the client to your agent's `model` field:

```typescript filename="src/mastra/agents/test-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const testAgent = new Agent({
  name: 'test-agent',
  instructions: 'You are a helpful assistant.',
  model: openai('gpt-4o-mini'),
});
```

  </TabItem>
</Tabs>

#### Instruction formats

Instructions define the agent's behavior, personality, and capabilities.
They are system-level prompts that establish the agent's core identity and expertise.

Instructions can be provided in multiple formats for greater flexibility. The examples below illustrate the supported shapes:

```typescript copy
// String (most common)
instructions: 'You are a helpful assistant.';

// Array of strings
instructions: ['You are a helpful assistant.', 'Always be polite.', 'Provide detailed answers.'];

// Array of system messages
instructions: [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'system', content: 'You have expertise in TypeScript.' },
];
```

#### Provider-specific options

Each model provider also enables a few different options, including prompt caching and configuring reasoning. We provide a `providerOptions` flag to manage these. You can set `providerOptions` on the instruction level to set different caching strategy per system instruction/prompt.

```typescript copy
// With provider-specific options (e.g., caching, reasoning)
instructions: {
  role: "system",
  content:
    "You are an expert code reviewer. Analyze code for bugs, performance issues, and best practices.",
  providerOptions: {
    openai: { reasoning_effort: "high" },        // OpenAI's reasoning models
    anthropic: { cache_control: { type: "ephemeral" } }  // Anthropic's prompt caching
  }
}
```

> See the [Agent reference doc](/docs/reference/agents/agent) for more information.

### Registering an agent

Register your agent in the Mastra instance to make it available throughout your application. Once registered, it can be called from workflows, tools, or other agents, and has access to shared resources such as memory, logging, and observability features:

```typescript showLineNumbers filename="src/mastra/index.ts" copy
import { Mastra } from '@mastra/core/mastra';
import { testAgent } from './agents/test-agent';

export const mastra = new Mastra({
  // ...
  agents: { testAgent },
});
```

## Referencing an agent

You can call agents from workflow steps, tools, the Mastra Client, or the command line. Get a reference by calling `.getAgent()` on your `mastra` or `mastraClient` instance, depending on your setup:

```typescript showLineNumbers copy
const testAgent = mastra.getAgent('testAgent');
```

:::tip Best Practice

`mastra.getAgent()` is preferred over a direct import, since it preserves the Mastra instance configuration (tools registered, telemetry, vector stores configuration for agent memory, etc.)

:::

> See [Calling agents](/docs/examples/agents/calling-agents) for more information.

## Generating responses

Agents can return results in two ways: generating the full output before returning it or streaming tokens in real time. Choose the approach that fits your use case: generate for short, internal responses or debugging, and stream to deliver pixels to end users as quickly as possible.

<Tabs>
  <TabItem value="generate" label="Generate">
Pass a single string for simple prompts, an array of strings when providing multiple pieces of context, or an array of message objects with `role` and `content`.

(The `role` defines the speaker for each message. Typical roles are `user` for human input, `assistant` for agent responses, and `system` for instructions.)

```typescript showLineNumbers copy
const response = await testAgent.generate([
  { role: 'user', content: 'Help me organize my day' },
  { role: 'user', content: 'My day starts at 9am and finishes at 5.30pm' },
  { role: 'user', content: 'I take lunch between 12:30 and 13:30' },
  { role: 'user', content: 'I have meetings Monday to Friday between 10:30 and 11:30' },
]);

console.log(response.text);
```

  </TabItem>
  <TabItem value="stream" label="Stream">

Pass a single string for simple prompts, an array of strings when providing multiple pieces of context, or an array of message objects with `role` and `content`.

(The `role` defines the speaker for each message. Typical roles are `user` for human input, `assistant` for agent responses, and `system` for instructions.)

```typescript showLineNumbers copy
const stream = await testAgent.stream([
  { role: 'user', content: 'Help me organize my day' },
  { role: 'user', content: 'My day starts at 9am and finishes at 5.30pm' },
  { role: 'user', content: 'I take lunch between 12:30 and 13:30' },
  { role: 'user', content: 'I have meetings Monday to Friday between 10:30 and 11:30' },
]);

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

### Completion using `onFinish()`

When streaming responses, the `onFinish()` callback runs after the LLM finishes generating its response and all tool executions are complete.
It provides the final `text`, execution `steps`, `finishReason`, token `usage` statistics, and other metadata useful for monitoring or logging.

```typescript showLineNumbers copy
const stream = await testAgent.stream('Help me organize my day', {
  onFinish: ({ steps, text, finishReason, usage }) => {
    console.log({ steps, text, finishReason, usage });
  },
});

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

  </TabItem>
</Tabs>

> See [.generate()](/docs/reference/agents/generate) or [.stream()](/docs/reference/streaming/agents/stream) for more information.

## Structured output

Agents can return structured, type-safe data by defining the expected output using either [Zod](https://zod.dev/) or [JSON Schema](https://json-schema.org/). We recommend Zod for better TypeScript support and developer experience. The parsed result is available on `response.object`, allowing you to work directly with validated and typed data.

### Using Zod

Define the `output` shape using [Zod](https://zod.dev/):

```typescript showLineNumbers copy
import { z } from 'zod';

const response = await testAgent.generate(
  [
    {
      role: 'system',
      content: 'Provide a summary and keywords for the following text:',
    },
    {
      role: 'user',
      content: 'Monkey, Ice Cream, Boat',
    },
  ],
  {
    structuredOutput: {
      schema: z.object({
        summary: z.string(),
        keywords: z.array(z.string()),
      }),
    },
    maxSteps: 1,
  },
);

console.log(response.object);
```

## Working with images

Agents can analyze and describe images by processing both the visual content and any text within them. To enable image analysis, pass an object with `type: 'image'` and the image URL in the `content` array. You can combine image content with text prompts to guide the agent's analysis.

```typescript showLineNumbers copy
const response = await testAgent.generate([
  {
    role: 'user',
    content: [
      {
        type: 'image',
        image: 'https://placebear.com/cache/395-205.jpg',
        mimeType: 'image/jpeg',
      },
      {
        type: 'text',
        text: 'Describe the image in detail, and extract all the text in the image.',
      },
    ],
  },
]);

console.log(response.text);
```

## Multi-step tool use

Agents can be enhanced with tools, functions that extend their capabilities beyond text generation. Tools allow agents to perform calculations, access external systems, and process data. Agents not only decide whether to call tools they're given, they determine the parameters that should be given to that tool.

For a detailed guide to creating and configuring tools, see the [Tools Overview](../tools-mcp/overview) page.

### Using `maxSteps`

The `maxSteps` parameter controls the maximum number of sequential LLM calls an agent can make. Each step includes generating a response, executing any tool calls, and processing the result. Limiting steps helps prevent infinite loops, reduce latency, and control token usage for agents that use tools. The default is 1, but can be increased:

```typescript showLineNumbers copy
const response = await testAgent.generate('Help me organize my day', {
  maxSteps: 5,
});

console.log(response.text);
```

### Using `onStepFinish`

You can monitor the progress of multi-step operations using the `onStepFinish` callback. This is useful for debugging or providing progress updates to users.

`onStepFinish` is only available when streaming or generating text without structured output.

```typescript showLineNumbers copy
const response = await testAgent.generate('Help me organize my day', {
  onStepFinish: ({ text, toolCalls, toolResults, finishReason, usage }) => {
    console.log({ text, toolCalls, toolResults, finishReason, usage });
  },
});
```

## Testing agents locally

There are two ways to run and test agents.

### Mastra Playground

With the Mastra Dev Server running you can test an agent from the Mastra Playground by visiting [http://localhost:4111/agents](http://localhost:4111/agents) in your browser.

> For more information, see the [Local Dev Playground](/docs/server-db/local-dev-playground) documentation.

### Command line

Create an agent response using `.generate()` or `.stream()`.

```typescript {7} filename="src/test-agent.ts" showLineNumbers copy
import 'dotenv/config';

import { mastra } from './mastra';

const agent = mastra.getAgent('testAgent');

const response = await agent.generate('Help me organize my day');

console.log(response.text);
```

> See [.generate()](/docs/reference/agents/generate) or [.stream()](/docs/reference/streaming/agents/stream) for more information.

To test this agent, run the following:

```bash copy
npx tsx src/test-agent.ts
```

## Related

- [Agent Memory](./agent-memory)
- [Dynamic Agents](/docs/examples/agents/dynamic-agents)
- [Agent Tools and MCP](./using-tools-and-mcp)
- [Calling Agents](/docs/examples/agents/calling-agents)

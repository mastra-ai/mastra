# Supervisor Agent

When building complex AI applications, you often need multiple specialized agents to collaborate on different aspects of a task. A supervisor agent enables one agent to act as a supervisor, coordinating the work of other agents, each focused on their own area of expertise. This structure allows agents to delegate, collaborate, and produce more advanced outputs than any single agent alone.

In this example, this system consists of three agents:

1. A [**Copywriter agent**](#copywriter-agent) that writes the initial content.
2. A [**Editor agent**](#editor-agent) that refines the content.
3. A [**Publisher agent**](#publisher-agent) that supervises and coordinates the other agents.

## Prerequisites

This example uses the `openai` model. Make sure to add `OPENAI_API_KEY` to your `.env` file.

```bash
OPENAI_API_KEY=<your-api-key>
```

## Copywriter agent

This `copywriterAgent` is responsible for writing the initial blog post content based on a given topic.

```typescript
import { Agent } from '@mastra/core/agent';

export const copywriterAgent = new Agent({
  id: 'copywriter-agent',
  name: 'Copywriter Agent',
  instructions: 'You are a copywriter agent that writes blog post copy.',
  model: 'openai/gpt-5.1',
});
```

## Copywriter tool

The `copywriterTool` provides an interface to call the `copywriterAgent` and passes in the `topic`.

```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const copywriterTool = createTool({
  id: 'copywriter-agent',
  description: 'Calls the copywriter agent to write blog post copy.',
  inputSchema: z.object({
    topic: z.string(),
  }),
  outputSchema: z.object({
    copy: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    const { topic } = context;

    const agent = mastra!.getAgent('copywriterAgent');
    const result = await agent!.generate(`Create a blog post about ${topic}`);

    return {
      copy: result.text,
    };
  },
});
```

## Editor agent

This `editorAgent` takes the initial copy and refines it to improve quality and readability.

```typescript
import { Agent } from '@mastra/core/agent';

export const editorAgent = new Agent({
  id: 'editor-agent',
  name: 'Editor Agent',
  instructions: 'You are an editor agent that edits blog post copy.',
  model: 'openai/gpt-5.1',
});
```

## Editor tool

The `editorTool` provides an interface to call the `editorAgent` and passes in the `copy`.

```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const editorTool = createTool({
  id: 'editor-agent',
  description: 'Calls the editor agent to edit blog post copy.',
  inputSchema: z.object({
    copy: z.string(),
  }),
  outputSchema: z.object({
    copy: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    const { copy } = context;

    const agent = mastra!.getAgent('editorAgent');
    const result = await agent.generate(`Edit the following blog post only returning the edited copy: ${copy}`);

    return {
      copy: result.text,
    };
  },
});
```

## Publisher agent

This `publisherAgent` coordinates the entire process by calling the `copywriterTool` first, then the `editorTool`.

```typescript
import { Agent } from '@mastra/core/agent';

import { copywriterTool } from '../tools/example-copywriter-tool';
import { editorTool } from '../tools/example-editor-tool';

export const publisherAgent = new Agent({
  id: 'publisher-agent',
  name: 'Publisher Agent',
  instructions:
    'You are a publisher agent that first calls the copywriter agent to write blog post copy about a specific topic and then calls the editor agent to edit the copy. Just return the final edited copy.',
  model: 'openai/gpt-5.1',
  tools: { copywriterTool, editorTool },
});
```

## Registering the agents

All three agents are registered in the main Mastra instance so they can be accessed by each other.

```typescript
import { Mastra } from '@mastra/core';

import { publisherAgent } from './agents/example-publisher-agent';
import { copywriterAgent } from './agents/example-copywriter-agent';
import { editorAgent } from './agents/example-editor-agent';

export const mastra = new Mastra({
  agents: { copywriterAgent, editorAgent, publisherAgent },
});
```

## Example usage

Use `getAgent()` to retrieve a reference to the agent, then call `generate()` with a prompt.

```typescript
import 'dotenv/config';

import { mastra } from './mastra';

const agent = mastra.getAgent('publisherAgent');

const response = await agent.generate(
  'Write a blog post about React JavaScript frameworks. Only return the final edited copy.',
);

console.log(response.text);
```

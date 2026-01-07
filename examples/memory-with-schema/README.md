# Working Memory with Schema

Use Zod schema to define the structure of information stored in working memory. Schema provides type safety and validation for the data that agents extract and persist across conversations.

It works with both streamed responses using `.stream()` and generated responses using `.generate()`, and requires a storage provider such as PostgreSQL, LibSQL, or Redis to persist data between sessions.

This example shows how to manage a todo list using a working memory schema.

## Prerequisites

This example uses the `openai` model. Make sure to add `OPENAI_API_KEY` to your `.env` file.

```bash
OPENAI_API_KEY=<your-api-key>
```

And install the following package:

```bash
npm install @mastra/libsql@beta
```

## Adding memory to an agent

To add LibSQL memory to an agent, use the `Memory` class and pass a `storage` instance using `LibSQLStore`. The `url` can point to a remote location or local file.

### Working memory with `schema`

Enable working memory by setting `workingMemory.enabled` to `true`. This allows the agent to remember structured information between interactions.

Providing a `schema` defines the shape in which the agent should remember information. In this example, it separates tasks into active and completed lists.

Threads group related messages into conversations. When `generateTitle` is enabled, each thread is automatically given a descriptive name based on its content.

```typescript
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';

export const workingMemorySchemaAgent = new Agent({
  name: 'working-memory-schema-agent',
  instructions: `
    You are a todo list AI agent.
    Always show the current list when starting a conversation.
    For each task, include: title with index number, due date, description, status, and estimated time.
    Use emojis for each field.
    Support subtasks with bullet points.
    Ask for time estimates to help with timeboxing.
  `,
  model: 'openai/gpt-5.1',
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:working-memory-schema.db',
    }),
    options: {
      workingMemory: {
        enabled: true,
        schema: z.object({
          items: z.array(
            z.object({
              title: z.string(),
              due: z.string().optional(),
              description: z.string(),
              status: z.enum(['active', 'completed']).default('active'),
              estimatedTime: z.string().optional(),
            }),
          ),
        }),
      },
      threads: {
        generateTitle: true,
      },
    },
  }),
});
```

## Usage examples

This example shows how to interact with an agent that uses a working memory schema to manage structured information. The agent updates and persists the todo list across multiple interactions within the same thread.

### Streaming a response using `.stream()`

This example sends a message to the agent with a new task. The response is streamed and includes the updated todo list.

```typescript
import 'dotenv/config';

import { mastra } from './mastra';

const threadId = '123';
const resourceId = 'user-456';

const agent = mastra.getAgent('workingMemorySchemaAgent');

const stream = await agent.stream(
  'Add a task: Build a new feature for our app. It should take about 2 hours and needs to be done by next Friday.',
  {
    memory: {
      thread: threadId,
      resource: resourceId,
    },
  },
);

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

### Generating a response using `.generate()`

This example sends a message to the agent with a new task. The response is returned as a single message and includes the updated todo list.

```typescript
import 'dotenv/config';

import { mastra } from './mastra';

const threadId = '123';
const resourceId = 'user-456';

const agent = mastra.getAgent('workingMemorySchemaAgent');

const response = await agent.generate(
  'Add a task: Build a new feature for our app. It should take about 2 hours and needs to be done by next Friday.',
  {
    memory: {
      thread: threadId,
      resource: resourceId,
    },
  },
);

console.log(response.text);
```

## Example output

The output demonstrates how the agent formats and returns the updated todo list using the structure defined by the zod schema.

```text
# Todo List
## Active Items
1. 🛠️ **Task:** Build a new feature for our app
   - 📅 **Due:** Next Friday
   - 📝 **Description:** Develop and integrate a new feature into the existing application.
   - ⏳ **Status:** Not Started
   - ⏲️ **Estimated Time:** 2 hours

## Completed Items
- None yet
```

## Example storage object

Working memory stores data in `.json` format, which would look similar to the below:

```json
{
  // ...
  "toolInvocations": [
    {
      // ...
      "args": {
        "memory": {
          "items": [
            {
              "title": "Build a new feature for our app",
              "due": "Next Friday",
              "description": "",
              "status": "active",
              "estimatedTime": "2 hours"
            }
          ]
        }
      }
    }
  ]
}
```

## Related

- [Calling Agents](https://mastra.ai/docs/agents/overview#referencing-an-agent)
- [Agent Memory](https://mastra.ai/docs/agents/agent-memory)
- [Serverless Deployment](https://mastra.ai/reference/storage/libsql)

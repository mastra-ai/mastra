---
title: "Memory Processors"
description: "Learn how memory processors manage context, filter messages, and integrate with agents."
---

# Memory Processors

Memory processors transform and filter messages as they pass through an agent with memory enabled. They manage context window limits, remove unnecessary content, and optimize the information sent to the language model.

When memory is enabled on an agent, Mastra adds memory processors to the agent's processor pipeline. These processors retrieve conversation history, working memory, and semantically relevant messages, then persist new messages after the model responds.

Memory processors are [processors](/docs/agents/processors) that operate specifically on memory-related messages and state.

## Built-in Memory Processors

Mastra automatically adds these processors when memory is enabled:

### MessageHistory

Retrieves conversation history and persists new messages.

**When you configure:**

```typescript
memory: new Memory({
  lastMessages: 10,
});
```

**Mastra internally:**

1. Creates a `MessageHistory` processor with `limit: 10`
2. Adds it to the agent's input processors (runs before the LLM)
3. Adds it to the agent's output processors (runs after the LLM)

**What it does:**

- **Input**: Fetches the last 10 messages from storage and prepends them to the conversation
- **Output**: Persists new messages to storage after the model responds

**Example:**

```typescript copy showLineNumbers
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { openai } from "@ai-sdk/openai";

const agent = new Agent({
  name: "my-agent",
  instructions: "You are a helpful assistant",
  model: openai("gpt-4o"),
  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:memory.db",
    }),
    lastMessages: 10, // MessageHistory processor automatically added
  }),
});
```

### SemanticRecall

Retrieves semantically relevant messages based on the current input and creates embeddings for new messages.

**When you configure:**

```typescript
memory: new Memory({
  semanticRecall: { enabled: true },
  vector: myVectorStore,
  embedder: myEmbedder,
});
```

**Mastra internally:**

1. Creates a `SemanticRecall` processor
2. Adds it to the agent's input processors (runs before the LLM)
3. Adds it to the agent's output processors (runs after the LLM)
4. Requires both a vector store and embedder to be configured

**What it does:**

- **Input**: Performs vector similarity search to find relevant past messages and prepends them to the conversation
- **Output**: Creates embeddings for new messages and stores them in the vector store for future retrieval

**Example:**

```typescript copy showLineNumbers
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { PineconeVector } from "@mastra/pinecone";
import { OpenAIEmbedder } from "@mastra/openai";
import { openai } from "@ai-sdk/openai";

const agent = new Agent({
  name: "semantic-agent",
  instructions: "You are a helpful assistant with semantic memory",
  model: openai("gpt-4o"),
  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:memory.db",
    }),
    vector: new PineconeVector({
      apiKey: process.env.PINECONE_API_KEY!,
      environment: "us-east-1",
    }),
    embedder: new OpenAIEmbedder({
      model: "text-embedding-3-small",
      apiKey: process.env.OPENAI_API_KEY!,
    }),
    semanticRecall: { enabled: true }, // SemanticRecall processor automatically added
  }),
});
```

### WorkingMemory

Manages working memory state across conversations.

**When you configure:**

```typescript
memory: new Memory({
  workingMemory: { enabled: true },
});
```

**Mastra internally:**

1. Creates a `WorkingMemory` processor
2. Adds it to the agent's input processors (runs before the LLM)
3. Requires a storage adapter to be configured

**What it does:**

- **Input**: Retrieves working memory state for the current thread and prepends it to the conversation
- **Output**: No output processing

**Example:**

```typescript copy showLineNumbers
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { openai } from "@ai-sdk/openai";

const agent = new Agent({
  name: "working-memory-agent",
  instructions: "You are an assistant with working memory",
  model: openai("gpt-4o"),
  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:memory.db",
    }),
    workingMemory: { enabled: true }, // WorkingMemory processor automatically added
  }),
});
```

## Manual Control and Deduplication

If you manually add a memory processor to `inputProcessors` or `outputProcessors`, Mastra will **not** automatically add it. This gives you full control over processor ordering:

```typescript copy showLineNumbers
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { MessageHistory } from "@mastra/memory/processors";
import { TokenLimiter } from "@mastra/core/processors";
import { LibSQLStore } from "@mastra/libsql";
import { openai } from "@ai-sdk/openai";

// Custom MessageHistory with different configuration
const customMessageHistory = new MessageHistory({
  storage: new LibSQLStore({ url: "file:memory.db" }),
  lastMessages: 20,
});

const agent = new Agent({
  name: "custom-memory-agent",
  instructions: "You are a helpful assistant",
  model: openai("gpt-4o"),
  memory: new Memory({
    storage: new LibSQLStore({ url: "file:memory.db" }),
    lastMessages: 10, // This would normally add MessageHistory(10)
  }),
  inputProcessors: [
    customMessageHistory, // Your custom one is used instead
    new TokenLimiter({ limit: 4000 }), // Runs after your custom MessageHistory
  ],
});
```

### Guardrails and Memory

By default, memory processors run first for input processing. This means:

- Messages are saved to memory first
- Then utility processors like `ToolCallFilter` and `TokenLimiter` filter what goes to the LLM
- This is usually what you want - full conversation history in memory, filtered context for the LLM

However, if you're using guardrails (content moderation, validation, etc.), you typically want them to run BEFORE memory processors for two reasons:

1. **Prevent invalid content from being saved to memory** - block inappropriate content before it's stored
2. **Efficiency** - avoid running expensive guardrail checks on already-validated content retrieved from memory

To achieve this, place guardrails BEFORE memory processors:

```typescript copy showLineNumbers
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { ContentModerationProcessor } from "./guardrails";
import { TokenLimiter } from "@mastra/core/processors";
import { openai } from "@ai-sdk/openai";

const memory = new Memory({
  lastMessages: 10,
});

const agent = new Agent({
  name: "moderated-agent",
  instructions: "You are a helpful assistant",
  model: openai("gpt-4o"),
  memory,
  inputProcessors: [
    // 1. Guardrails first - blocks inappropriate content
    new ContentModerationProcessor(),

    // 2. Memory processors - only saves allowed content
    memory,

    // 3. Utility processors - work automatically after memory
    new TokenLimiter(4000),
  ],
});
```

With this ordering:

- Guardrails validate/filter NEW input before it reaches memory
- Retrieved memory content bypasses guardrails (already validated)
- Only appropriate content is saved to memory
- Token limiting and other utilities work automatically after memory

## Related documentation

- [Processors](/docs/agents/processors) - General processor concepts and custom processor creation
- [Guardrails](/docs/agents/guardrails) - Security and validation processors
- [Memory Overview](/docs/memory/overview) - Memory types and configuration

When creating custom processors avoid mutating the input `messages` array or its objects directly.

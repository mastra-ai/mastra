---
title: "Processors"
sidebar_title: "Processors"
description: "Learn how to use input and output processors to transform, validate, and control messages in Mastra agents."
sidebar_position: 4
---

# Processors

Processors transform, validate, or control messages as they pass through an agent. They run at specific points in the agent's execution pipeline, allowing you to modify inputs before they reach the language model or outputs before they're returned to users.

Processors are configured as:

- **`inputProcessors`**: Run before messages reach the language model.
- **`outputProcessors`**: Run after the language model generates a response, but before it's returned to users.

Some processors implement both input and output logic and can be used in either array depending on where the transformation should occur.

## When to use processors

Use processors to:

- Normalize or validate user input
- Detect and prevent prompt injection or jailbreak attempts
- Moderate content for safety or compliance
- Transform messages (e.g., translate languages, filter tool calls)
- Limit token usage or message history length
- Redact sensitive information (PII)
- Apply custom business logic to messages

Mastra includes several processors for common use cases. You can also create custom processors for application-specific requirements.

## Adding processors to an agent

Import and instantiate the processor, then pass it to the agent's `inputProcessors` or `outputProcessors` array:

```typescript {3,9-15} filename="src/mastra/agents/moderated-agent.ts" showLineNumbers copy
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { ModerationProcessor } from "@mastra/core/processors";

export const moderatedAgent = new Agent({
  name: "moderated-agent",
  instructions: "You are a helpful assistant",
  model: openai("gpt-4o-mini"),
  inputProcessors: [
    new ModerationProcessor({
      model: openai("gpt-4.1-nano"),
      categories: ["hate", "harassment", "violence"],
      threshold: 0.7,
      strategy: "block",
    }),
  ],
});
```

## Execution order

Processors run in the order they appear in the array:

```typescript
inputProcessors: [
  new UnicodeNormalizer(),
  new PromptInjectionDetector(),
  new ModerationProcessor(),
];
```

For output processors, the order determines the sequence of transformations applied to the model's response.

Memory processors (when memory is enabled) are automatically added to the agent's processor pipeline. See [Memory Processors](/docs/memory/memory-processors) for details on how memory processors integrate with manually configured processors.

## Creating custom processors

Custom processors implement the `InputProcessor` or `OutputProcessor` interface:

### Custom input processor

```typescript filename="src/mastra/processors/custom-input.ts" showLineNumbers copy
import type {
  InputProcessor,
  MastraMessageV2,
  RuntimeContext,
} from "@mastra/core";

export class CustomInputProcessor implements InputProcessor {
  name = "custom-input";

  async processInput({
    messages,
    context,
  }: {
    messages: MastraMessageV2[];
    context: RuntimeContext;
  }): Promise<MastraMessageV2[]> {
    // Transform messages before they reach the LLM
    return messages.map((msg) => ({
      ...msg,
      content: {
        ...msg.content,
        content: msg.content.content.toLowerCase(),
      },
    }));
  }
}
```

### Custom output processor

```typescript filename="src/mastra/processors/custom-output.ts" showLineNumbers copy
import type {
  OutputProcessor,
  MastraMessageV2,
  RuntimeContext,
} from "@mastra/core";

export class CustomOutputProcessor implements OutputProcessor {
  name = "custom-output";

  async processOutputResult({
    messages,
    context,
  }: {
    messages: MastraMessageV2[];
    context: RuntimeContext;
  }): Promise<MastraMessageV2[]> {
    // Transform messages after the LLM generates them
    return messages.filter((msg) => msg.role !== "system");
  }

  async processOutputStream({
    stream,
    context,
  }: {
    stream: ReadableStream;
    context: RuntimeContext;
  }): Promise<ReadableStream> {
    // Transform streaming responses
    return stream;
  }
}
```

Both `processInput` and `processOutputResult` receive a `context` object containing execution metadata such as `threadId`, `resourceId`, and other runtime information.

## Built-in Utility Processors

Mastra provides utility processors for common tasks:

**For security and validation processors**, see the [Guardrails](/docs/agents/guardrails) page for input/output guardrails and moderation processors.
**For memory-specific processors**, see the [Memory Processors](/docs/memory/memory-processors) page for processors that handle message history, semantic recall, and working memory.

### TokenLimiter

Prevents context window overflow by removing older messages when the total token count exceeds a specified limit.

```typescript copy showLineNumbers {9-12}
import { Agent } from "@mastra/core/agent";
import { TokenLimiter } from "@mastra/core/processors";
import { openai } from "@ai-sdk/openai";

const agent = new Agent({
  name: "my-agent",
  model: openai("gpt-4o"),
  inputProcessors: [
    // Ensure the total tokens don't exceed ~127k
    new TokenLimiter(127000),
  ],
});
```

The `TokenLimiter` uses the `o200k_base` encoding by default (suitable for GPT-4o). You can specify other encodings for different models:

```typescript copy showLineNumbers {6-9}
import cl100k_base from "js-tiktoken/ranks/cl100k_base";

const agent = new Agent({
  name: "my-agent",
  inputProcessors: [
    new TokenLimiter({
      limit: 16000, // Example limit for a 16k context model
      encoding: cl100k_base,
    }),
  ],
});
```

### ToolCallFilter

Removes tool calls from messages sent to the LLM, saving tokens by excluding potentially verbose tool interactions.

```typescript copy showLineNumbers {5-14}
import { Agent } from "@mastra/core/agent";
import { ToolCallFilter, TokenLimiter } from "@mastra/core/processors";
import { openai } from "@ai-sdk/openai";

const agent = new Agent({
  name: "my-agent",
  model: openai("gpt-4o"),
  inputProcessors: [
    // Example 1: Remove all tool calls/results
    new ToolCallFilter(),

    // Example 2: Remove only specific tool calls
    new ToolCallFilter({ exclude: ["generateImageTool"] }),

    // Always place TokenLimiter last
    new TokenLimiter(127000),
  ],
});
```

> **Note:** The example above filters tool calls and limits tokens for the LLM, but these filtered messages will still be saved to memory. To also filter messages before they're saved to memory, manually add memory processors before utility processors. See [Memory Processors](/docs/memory/memory-processors#manual-control-and-deduplication) for details.

## Related documentation

- [Guardrails](/docs/agents/guardrails) - Security and validation processors
- [Memory Processors](/docs/memory/memory-processors) - Memory-specific processors and automatic integration

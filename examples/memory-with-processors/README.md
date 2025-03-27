# Mastra Memory Processors Example

This example demonstrates how to use and create memory processors in Mastra. Memory processors allow you to filter or transform messages before they're sent to the LLM, which is useful for:

- Limiting token usage to prevent context overflow
- Filtering out specific message types (e.g., tool calls)
- Removing sensitive or confidential information
- Creating custom filtering logic for specialized use cases

## Included Demos

### 1. Token Limiting with Support Agent

The support agent demo (`npm run start`) showcases the `TokenLimiter` processor, which:

- Limits conversation history to 2000 tokens
- Automatically prioritizes keeping the most recent messages
- Demonstrates how older messages get forgotten when token limits are reached

### 2. Content Filtering with Interview Agent

The forgetful interview agent demo (`npm run chat`) showcases:

- `ToolCallFilter`: Removes all tool calls from the conversation history
- `ForgetfulProcessor`: Replaces messages containing specific keywords ("name", "work", etc) with a message telling the agent it forgot
- Interactive chat where you can see how this content is "forgotten"

## Installation

```bash
pnpm install
```

## Usage

Run the token limiting demo:

```bash
pnpm run start
```

Run the interactive content filtering demo:

```bash
pnpm run chat
```

## Creating Your Own Processors

To create a custom processor, implement the `MessageProcessor` interface:

```typescript
import type { CoreMessage } from '@mastra/core';
import type { MessageProcessor } from '@mastra/core/memory';

class CustomProcessor implements MessageProcessor {
  process(messages: CoreMessage[]): CoreMessage[] {
    // Filter or transform messages here
    return filteredMessages;
  }
}
```

Then use it when creating your Memory instance:

```typescript
const memory = new Memory({
  processors: [
    new CustomProcessor(),
    // Can be combined with built-in processors
    new TokenLimiter(8000),
  ],
});
```


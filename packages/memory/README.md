# @mastra/memory

Experimental

# Mastra Memory

Memory management for Mastra agents.

## Message Processors

Memory now supports message processors that can filter or transform messages before they're sent to the LLM. Mastra provides two built-in processors:

1. **TokenLimiter**: Limits tokens by prioritizing recent messages while preserving chronological order
2. **ToolCallFilter**: Removes specific tool calls (or all tool calls) from the message history

> **Note**: Processors only filter messages retrieved from memory, not new messages being sent to the LLM.

### Basic Example

```typescript
import { Memory, TokenLimiter, ToolCallFilter } from '@mastra/memory';
import { openai } from '@ai-sdk/openai';

// Create memory with processors
const memory = new Memory({
  options: {
    lastMessages: 20,
    processors: [
      // Remove all tool calls by default
      new ToolCallFilter(),
      
      // Then limit total tokens to 8000
      new TokenLimiter(8000),
    ],
  },
});

// Use memory with an agent
const agent = new Agent({
  name: "Support Agent",
  instructions: "You are a helpful AI assistant.",
  model: openai("gpt-4o-mini"),
  memory,
});

// Override or add processors for a specific query
await agent.stream("What was our conversation about?", {
  threadId: "thread_id",
  resourceId: "user_id",
  memoryOptions: {
    // For this specific call, only remove audio-player tools and use a lower token limit
    processors: [
      new ToolCallFilter({ exclude: ['audio-player'] }),
      new TokenLimiter(4000)
    ],
  },
});
```

### TokenLimiter Options

The TokenLimiter uses the document chunking functionality from `@mastra/rag` with cl100k_base encoding for accurate token counting.

```typescript
// Simple usage - limit to 8000 tokens
new TokenLimiter(8000)
```

### ToolCallFilter Options

The ToolCallFilter can be configured in two ways:

```typescript
// By default (no args): Exclude all tool calls
new ToolCallFilter()

// To exclude only specific tools by name:
new ToolCallFilter({ 
  exclude: ['audio-player', 'video-player'] 
})
```

### Custom Processors

You can create custom processors by implementing the `MessageProcessor` interface:

```typescript
import { MessageProcessor, CoreMessage } from '@mastra/memory';

// Simple example of implementing the MessageProcessor interface
class SimpleMessageFilter implements MessageProcessor {
  process(messages: CoreMessage[]): CoreMessage[] {
    // Return a subset of messages based on your criteria
    return messages.slice(0, 10); // For example, just keep the first 10 messages
  }
}

// Use the processor
const memory = new Memory({
  options: {
    processors: [new SimpleMessageFilter()]
  }
});
```

### Multiple Processors

You can apply multiple processors by passing them in an array:

```typescript
import { TokenLimiter, ToolCallFilter } from '@mastra/memory';

// Apply multiple processors in sequence
const memory = new Memory({
  options: {
    processors: [
      new ToolCallFilter({ exclude: ['audio-player'] }), // First filter tool calls
      new TokenLimiter(8000)                             // Then limit tokens
    ]
  }
});
```

### Simple Custom Processor

You can implement the `MessageProcessor` interface with a class:

```typescript
import { MessageProcessor, CoreMessage } from '@mastra/memory';

// Simple example of implementing the MessageProcessor interface
class SimpleMessageFilter implements MessageProcessor {
  process(messages: CoreMessage[]): CoreMessage[] {
    // Return a subset of messages based on your criteria
    return messages.slice(0, 10); // For example, just keep the first 10 messages
  }
}

// Use it in memory configuration
const memory = new Memory({
  options: {
    processors: [new SimpleMessageFilter()]
  }
});
```

Or you can implement it directly as an object:

```typescript
import { MessageProcessor } from '@mastra/memory';

// Define processor as an object
const simpleFilter: MessageProcessor = {
  process(messages) {
    // Simple implementation that only keeps the last 5 messages
    return messages.slice(-5);
  }
};

// Use the processor
const memory = new Memory({
  options: {
    processors: [simpleFilter]
  }
});
```

### Practical Examples

Here are some practical examples of custom processors:

#### Reasoning Filter

This filter removes reasoning parts from messages, keeping only the final responses:

```typescript
import { MessageProcessor, CoreMessage } from '@mastra/memory';

// Define processor as a class
class ReasoningFilter implements MessageProcessor {
  process(messages: CoreMessage[]): CoreMessage[] {
    return messages.map(message => {
      if (Array.isArray(message.content)) {
        // Filter out any reasoning parts from the content
        return {
          ...message,
          content: message.content.filter(part => 
            part.type !== 'reasoning' && part.type !== 'redacted-reasoning'
          )
        };
      }
      return message;
    }).filter(message => {
      // Keep messages that still have content after filtering
      if (Array.isArray(message.content)) {
        return message.content.length > 0;
      }
      return true;
    });
  }
}

// Use it in memory configuration
const memory = new Memory({
  options: {
    processors: [new ReasoningFilter()]
  }
});
```

## License

MIT

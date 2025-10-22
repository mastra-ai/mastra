# `addStreamPart()` vs `parseNetworkData()` - Clarification

## Your Questions

1. **Why not `MessageList.addStreamPart()`?**
2. **What would `parseNetworkData()` do?**

---

## 1. Why `addStreamPart()` Makes Sense

### Current Problem

The loop manually converts `ChunkType` → `MastraMessageV2`:

```typescript
// packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts

case 'text-delta':
  messageList.add(
    {
      id: messageId,
      role: 'assistant',
      content: [{ type: 'text', text: chunk.payload.text }]  // Manual V2 construction
    },
    'response'
  );
  break;

case 'reasoning-start':
  messageList.add(
    {
      id: messageId,
      role: 'assistant',
      content: [{
        type: 'reasoning',
        text: '',
        providerOptions: chunk.payload.providerMetadata
      }]  // Manual V2 construction
    },
    'response'
  );
  break;

case 'file':
  messageList.add(
    {
      id: messageId,
      role: 'assistant',
      content: [{ type: 'file', data, mimeType }]  // Manual V2 construction
    },
    'response'
  );
  break;
```

**Issues:**
- Loop needs to know MastraMessageV2 structure
- Conversion logic scattered across 10+ case statements
- If V2 format changes, must update loop code
- Violates separation of concerns

### Better Approach: `addStreamPart()`

```typescript
// Loop just passes raw chunks
case 'text-delta':
  messageList.addStreamPart(chunk);  // MessageList handles conversion
  break;

case 'reasoning-start':
  messageList.addStreamPart(chunk);
  break;

case 'file':
  messageList.addStreamPart(chunk);
  break;
```

**Benefits:**
- Loop doesn't need to know V2 structure
- Conversion logic centralized in MessageList
- Easier to maintain and test
- Clear separation: Loop = streaming logic, MessageList = format handling

### Implementation

```typescript
// packages/core/src/agent/message-list/index.ts

class MessageList {
  /**
   * Add a stream chunk and convert it to MastraMessageV2 format
   */
  addStreamPart(chunk: ChunkType): void {
    const message = this.chunkToMessage(chunk);
    if (message) {
      this.add(message, 'response');
    }
  }

  private chunkToMessage(chunk: ChunkType): MastraMessageV2 | null {
    switch (chunk.type) {
      case 'text-delta':
        return {
          id: chunk.payload.id,
          role: 'assistant',
          content: [{
            type: 'text',
            text: chunk.payload.text
          }]
        };

      case 'reasoning-start':
        return {
          id: chunk.payload.id,
          role: 'assistant',
          content: [{
            type: 'reasoning',
            text: '',
            providerOptions: chunk.payload.providerMetadata
          }]
        };

      case 'file':
        return {
          id: chunk.payload.id,
          role: 'assistant',
          content: [{
            type: 'file',
            data: chunk.payload.data,
            mimeType: chunk.payload.mimeType
          }]
        };

      case 'source':
        return {
          id: chunk.payload.id,
          role: 'assistant',
          content: {
            format: 2,
            parts: [{
              type: 'source',
              source: {
                sourceType: chunk.payload.sourceType,
                id: chunk.payload.id,
                url: chunk.payload.url || '',
                title: chunk.payload.title,
                providerMetadata: chunk.payload.providerMetadata
              }
            }]
          }
        };

      case 'tool-call':
      case 'tool-result':
        // These are handled differently (accumulated, not added immediately)
        return null;

      default:
        return null;
    }
  }
}
```

---

## 2. What `parseNetworkData()` Does

### The Problem: Network Data is Stored as JSON String

When a network agent executes, the result is stored as a **JSON string** in a text part:

```typescript
// packages/core/src/loop/network/index.ts (line 565)

await memory?.saveMessages({
  messages: [{
    id: generateId(),
    type: 'text',
    role: 'assistant',
    content: {
      parts: [{
        type: 'text',
        text: JSON.stringify({  // ⚠️ Stored as JSON string
          isNetwork: true,
          selectionReason: '...',
          primitiveType: 'agent',
          primitiveId: 'my-agent',
          input: 'user query',
          finalResult: {
            text: 'final answer',
            toolCalls: [...],
            messages: [...]
          }
        })
      }],
      format: 2
    }
  }]
});
```

**Storage format (MastraMessageV2):**
```json
{
  "role": "assistant",
  "content": {
    "parts": [{
      "type": "text",
      "text": "{\"isNetwork\":true,\"primitiveId\":\"my-agent\",\"finalResult\":{...}}"
    }]
  }
}
```

### The Solution: Parse During Conversion

When converting V2 → V3/V5 for UI display, MessageList should parse this JSON and convert it to a proper `dynamic-tool` part:

**Target format (AI SDK V5 UIMessage):**
```json
{
  "role": "assistant",
  "parts": [{
    "type": "dynamic-tool",
    "toolCallId": "my-agent",
    "toolName": "my-agent",
    "state": "output-available",
    "input": "user query",
    "output": {
      "result": "final answer",
      "childMessages": [
        { "type": "tool", "toolName": "search", "args": {...}, "toolOutput": {...} },
        { "type": "text", "content": "final answer" }
      ]
    }
  }],
  "metadata": {
    "mode": "network",
    "selectionReason": "...",
    "from": "AGENT"
  }
}
```

### Implementation

```typescript
// packages/core/src/agent/message-list/index.ts

class MessageList {
  get all() {
    return {
      v3: (options = { parseNetworkData: true }) => {
        return this.messages.map(msg => {
          if (options.parseNetworkData) {
            return this.parseNetworkData(msg);
          }
          return this.v2ToV3(msg);
        });
      },
      
      aiV5: {
        ui: (options = { parseNetworkData: true }) => {
          return this.messages.map(msg => {
            if (options.parseNetworkData) {
              return this.parseNetworkData(msg);
            }
            return this.v2ToAIV5UI(msg);
          });
        }
      }
    };
  }

  /**
   * Parse network execution data from JSON string to dynamic-tool part
   */
  private parseNetworkData(msg: MastraMessageV2): MastraMessageV3 {
    // Check if this is a network message
    const textPart = msg.content.parts?.find(
      part => part.type === 'text' && part.text.includes('"isNetwork":true')
    );

    if (!textPart || textPart.type !== 'text') {
      // Not a network message, return normal conversion
      return this.v2ToV3(msg);
    }

    try {
      const networkData = JSON.parse(textPart.text);

      if (networkData.isNetwork !== true) {
        return this.v2ToV3(msg);
      }

      // Extract data
      const { primitiveId, primitiveType, selectionReason, input, finalResult } = networkData;
      const toolCalls = finalResult?.toolCalls || [];
      const messages = finalResult?.messages || [];

      // Build child messages from tool calls
      const childMessages: ChildMessage[] = [];

      for (const toolCall of toolCalls) {
        if (toolCall.type === 'tool-call' && toolCall.payload) {
          const toolCallId = toolCall.payload.toolCallId;

          // Find matching tool result
          let toolResult;
          for (const message of messages) {
            for (const part of message.content || []) {
              if (part.type === 'tool-result' && part.toolCallId === toolCallId) {
                toolResult = part;
                break;
              }
            }
          }

          const isWorkflow = Boolean(toolResult?.result?.result?.steps);

          childMessages.push({
            type: 'tool',
            toolCallId: toolCall.payload.toolCallId,
            toolName: toolCall.payload.toolName,
            args: toolCall.payload.args,
            toolOutput: isWorkflow ? toolResult?.result?.result : toolResult?.result
          });
        }
      }

      // Add final text result
      if (finalResult?.text) {
        childMessages.push({
          type: 'text',
          content: finalResult.text
        });
      }

      // Return transformed message with dynamic-tool part
      return {
        role: 'assistant',
        parts: [{
          type: 'dynamic-tool',
          toolCallId: primitiveId,
          toolName: primitiveId,
          state: 'output-available',
          input: input,
          output: {
            result: finalResult?.text || '',
            childMessages: childMessages
          }
        }],
        id: msg.id,
        metadata: {
          ...msg.metadata,
          mode: 'network',
          selectionReason: selectionReason,
          agentInput: input,
          from: primitiveType === 'agent' ? 'AGENT' : 'WORKFLOW'
        }
      };
    } catch (error) {
      // If parsing fails, return normal conversion
      console.warn('Failed to parse network data:', error);
      return this.v2ToV3(msg);
    }
  }
}
```

---

## Summary

### `addStreamPart()`
**Purpose**: Convert streaming chunks to V2 format during ingestion

**Location**: Loop → MessageList (write path)

**What it does**:
```
ChunkType (text-delta, file, source, etc.)
    ↓
MessageList.addStreamPart()
    ↓
Convert to MastraMessageV2
    ↓
Store in MessageList
```

### `parseNetworkData()`
**Purpose**: Convert network JSON strings to dynamic-tool parts during retrieval

**Location**: MessageList → Consumer (read path)

**What it does**:
```
MastraMessageV2 (with JSON string in text part)
    ↓
MessageList.get.all.v3() or .aiV5.ui()
    ↓
parseNetworkData()
    ↓
Convert to MastraMessageV3/UIMessage (with dynamic-tool part)
    ↓
Return to consumer
```

---

## Recommendation

**Implement both:**

1. ✅ **`addStreamPart()`** - Centralizes ChunkType → V2 conversion
2. ✅ **`parseNetworkData()`** - Centralizes network JSON → dynamic-tool conversion

This gives MessageList full ownership of format conversions in both directions:
- **Write path**: Chunks → V2 (via `addStreamPart`)
- **Read path**: V2 → V3/V5 (via `parseNetworkData`)

The loop becomes much simpler:
```typescript
// Before: 200+ lines of manual conversion
case 'text-delta':
  messageList.add({ id, role: 'assistant', content: [{ type: 'text', text }] }, 'response');
  break;

// After: 1 line
case 'text-delta':
  messageList.addStreamPart(chunk);
  break;
```

And frontend code becomes simpler:
```typescript
// Before: Manual parsing in React SDK
const messages = resolveInitialMessages(apiMessages);

// After: Server already returns parsed format
const messages = await client.memory.thread(threadId).getMessages();
// Already has dynamic-tool parts, no parsing needed
```

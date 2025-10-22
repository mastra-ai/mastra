# Memory & Message Normalization Plan

## Executive Summary

This plan addresses the fragmentation and confusion around message formats in Mastra by centralizing all message conversion logic in `MessageList` and providing a seamless, zero-config experience for users across all consumption patterns (React SDK, client-js, raw fetch).

## Problem Statement

### Current Issues

1. **Format Confusion**: Users encounter multiple message formats (V1, V2, V3, AI SDK V4, AI SDK V5) without clear guidance
2. **Scattered Conversion Logic**: Network data parsing happens in React SDK, other conversions in MessageList, some in server handlers
3. **Incomplete Documentation**: Users report outdated/unclear docs about when to use `convertMessages()` or `convertToModelMessages()`
4. **Breaking Changes**: Subtle issues when using Mastra with AI SDK v5, validation errors with workflow chunks
5. **Manual Normalization**: Users must manually convert messages in various scenarios, leading to errors

### User Pain Points (from GitHub)

```
"When using memory / tools / reasoning - you need to convert messages via 
convertToModelMessages or mastras `convertMessages(messages).to("AIV5.Model");`
But documentation is unclear - seems to be incomplete / outdated / wip ..."

"There are really a lot of subtle issues when using Mastra with AI-SDK v5. 
I'll stop using Mastra until a stable version is fully prepared for it."

"validation failed: Value: {"type":"workflow-start",...}"
```

## Solution Architecture

### Core Principle
**"Zero-Config Message Handling"** - Users should never need to manually convert messages. The system should handle all conversions transparently based on context.

### Three-Tier Approach

```
┌─────────────────────────────────────────────────────────────┐
│                    USER CONSUMPTION LAYER                    │
│  (React SDK useChat, client-js, raw fetch, server-side)     │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   NORMALIZATION LAYER                        │
│              (MessageList + Server Handlers)                 │
│  • Automatic format detection                               │
│  • Network data parsing                                      │
│  • Working memory stripping                                  │
│  • Streaming chunk conversion                                │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     STORAGE LAYER                            │
│              (MastraMessageV2 canonical format)              │
└─────────────────────────────────────────────────────────────┘
```

## Critical Architectural Finding: Loop → MessageList Flow

### Current State

The streaming loop (`packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts`) **already passes chunks directly to MessageList**:

```typescript
// Line 82: text-delta chunks
messageList.add({ id, role: 'assistant', content: [{ type: 'text', text }] }, 'response');

// Line 204: reasoning chunks  
messageList.add({ id, role: 'assistant', content: [{ type: 'reasoning', text }] }, 'response');

// Line 275: file chunks
messageList.add({ id, role: 'assistant', content: [{ type: 'file', data, mimeType }] }, 'response');

// Line 293: source chunks
messageList.add({ id, role: 'assistant', content: { format: 2, parts: [{ type: 'source', ... }] } }, 'response');
```

**Key Insight**: The loop converts `ChunkType` → `MastraMessageV2` format and adds it to `MessageList` in real-time during streaming. `MessageList` then provides various getters to convert to different output formats:

- `messageList.get.response.aiV5.ui()` → AI SDK V5 UIMessage[]
- `messageList.get.response.aiV5.model()` → AI SDK V5 CoreMessage[]
- `messageList.get.response.v2()` → MastraMessageV2[]

### The Problem

**MessageList is already the normalization hub**, but:

1. **Network data parsing** happens outside MessageList (in React SDK's `resolveInitialMessages`)
2. **Chunk validation** happens in multiple places without a central schema
3. **Format detection** is implicit, not explicit

### The Solution

**Enhance MessageList's existing role** rather than creating new patterns. MessageList should:

1. ✅ Already does: Convert chunks to V2 format during streaming
2. ✅ Already does: Convert V2 to various output formats (V3, V4, V5)
3. ❌ Missing: Parse network data during V2→V3/V5 conversion
4. ❌ Missing: Validate chunks before adding them
5. ❌ Missing: Auto-detect and convert incoming message formats

## Implementation Plan

### Phase 1: Storage Layer - Extend MastraMessageV2 (Week 1)

#### 1.1 Add Network Metadata Field

**File**: `packages/core/src/agent/message-list/index.ts`

Add structured field to `MastraMessageV2`:

```typescript
export type NetworkExecutionMetadata = {
  isNetwork: true;
  selectionReason?: string;
  primitiveType?: 'agent' | 'workflow';
  primitiveId?: string;
  finalResult?: {
    text?: string;
    toolCalls?: Array<{
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
      result?: unknown;
    }>;
    messages?: MastraMessageV2[];
  };
};

export type MastraMessageContentV2 = {
  format: 2;
  parts: (AIV4Type.UIMessage['parts'][number] & { providerMetadata?: AIV5Type.ProviderMetadata })[];
  experimental_attachments?: AIV4Type.UIMessage['experimental_attachments'];
  content?: AIV4Type.UIMessage['content'];
  toolInvocations?: AIV4Type.UIMessage['toolInvocations'];
  reasoning?: AIV4Type.UIMessage['reasoning'];
  annotations?: AIV4Type.UIMessage['annotations'];
  metadata?: Record<string, unknown>;
  networkExecution?: NetworkExecutionMetadata; // NEW
};
```

#### 1.2 Update Network Loop (Write Path)

**File**: `packages/core/src/loop/network/index.ts` (line ~565)

Replace JSON stringification with structured storage:

```typescript
// BEFORE (current):
messageList.add({
  response: {
    id: nanoid(),
    role: 'assistant',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [
        {
          type: 'text',
          text: JSON.stringify({
            isNetwork: true,
            selectionReason,
            primitiveType,
            primitiveId,
            finalResult: { ... },
          }),
        },
      ],
    },
  },
});

// AFTER:
messageList.add({
  response: {
    id: nanoid(),
    role: 'assistant',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: finalResult.text ? [{ type: 'text', text: finalResult.text }] : [],
      networkExecution: {
        isNetwork: true,
        selectionReason,
        primitiveType,
        primitiveId,
        finalResult: {
          text: finalResult.text,
          toolCalls: finalResult.toolCalls,
          messages: finalResult.messages,
        },
      },
    },
  },
});
```

### Phase 2: MessageList Conversion (Week 1-2)

#### 2.1 Add Network Metadata Conversion (Read Path)

**File**: `packages/core/src/agent/message-list/index.ts`

Add helper to convert network metadata to `dynamic-tool` parts:
  
  // New method to parse embedded network data
  private parseNetworkDataInMessages(messages: MastraMessageV2[]): MastraMessageV3[] {
    return messages.map(msg => {
      if (msg.role !== 'assistant') return this.v2ToV3(msg);
      
      const parts = msg.content.map(part => {
        if (part.type !== 'text') return part;
        
        // Type-safe network data detection
        try {
          const parsed = JSON.parse(part.text);
          if (parsed.isNetwork === true) {
            return this.convertNetworkDataToDynamicTool(parsed);
          }
        } catch {
          // Not JSON, return as-is
        }
        
        return part;
      });
      
      return { ...this.v2ToV3(msg), content: parts };
    });
  }
  
  private convertNetworkDataToDynamicTool(networkData: NetworkExecutionResult): DynamicToolPart {
    // Extract tool calls, results, child messages
    // Convert to dynamic-tool part with childMessages
    // This logic moves from resolveInitialMessages.ts
  }
}
```

**Changes to Getters**:
```typescript
// Update all UI format getters to parse network data by default
get.all.v3(options?: { parseNetworkData?: boolean }): MastraMessageV3[] {
  const parseNetwork = options?.parseNetworkData ?? true;
  const v3Messages = this.allMessages.map(m => this.v2ToV3(m));
  return parseNetwork ? this.parseNetworkDataInMessages(v3Messages) : v3Messages;
}

get.all.aiV5.ui(options?: { parseNetworkData?: boolean }): UIMessage[] {
  const v3Messages = this.get.all.v3(options);
  return v3Messages.map(m => this.v3ToAIV5UI(m));
}
```

#### 1.2 Add Streaming Chunk Validation

**File**: `packages/core/src/agent/message-list/utils/validate-chunk.ts` (new)

```typescript
import { ChunkType } from '@mastra/core/stream';
import { z } from 'zod';

// Zod schemas for each chunk type
const textDeltaSchema = z.object({
  type: z.literal('text-delta'),
  textDelta: z.string(),
});

const workflowStartSchema = z.object({
  type: z.literal('workflow-start'),
  runId: z.string(),
  from: z.literal('WORKFLOW'),
  payload: z.object({
    workflowId: z.string(),
  }),
});

// ... schemas for all chunk types

export function validateChunk(chunk: unknown): ChunkType {
  // Try each schema, return validated chunk or throw descriptive error
  // This prevents "validation failed: Value: {...}" errors
}
```

#### 1.3 Add Format Detection Utility

**File**: `packages/core/src/agent/message-list/utils/detect-format.ts` (new)

```typescript
export type MessageFormat = 
  | 'MastraV1' 
  | 'MastraV2' 
  | 'MastraV3' 
  | 'AIV4.Core' 
  | 'AIV4.UI' 
  | 'AIV5.Model' 
  | 'AIV5.UI';

export function detectMessageFormat(messages: unknown[]): MessageFormat {
  // Heuristic-based detection
  // Check for presence of specific fields
  // Return detected format
}

export function autoConvert(
  messages: unknown[], 
  targetFormat: MessageFormat
): any[] {
  const sourceFormat = detectMessageFormat(messages);
  return convertMessages(messages as any).from(sourceFormat).to(targetFormat);
}
```

### Phase 2: Server Handler Updates

#### 2.1 Memory Handler Standardization

**File**: `packages/server/src/server/handlers/memory.ts`

```typescript
export async function getMessagesHandler({
  mastra,
  agentId,
  threadId,
  limit,
  runtimeContext,
}: MemoryContext & { limit?: number }) {
  try {
    const memory = await getMemoryFromContext({ mastra, agentId, runtimeContext });
    validateBody({ threadId });
    if (!memory) {
      throw new HTTPException(400, { message: 'Memory is not initialized' });
    }

    const thread = await memory.getThreadById({ threadId: threadId! });
    if (!thread) {
      throw new HTTPException(404, { message: 'Thread not found' });
    }

    const result = await memory.query({
      threadId: threadId!,
      ...(limit && { selectBy: { last: limit } }),
    });
    
    // Use MessageList for all conversions
    const messageList = new MessageList();
    messageList.add.memory(result.messagesV2);
    
    return {
      // AI SDK V4 Core format (for backward compat)
      messages: messageList.get.all.aiV4.core(),
      
      // AI SDK V5 UI format (with network data parsed)
      uiMessages: messageList.get.all.aiV5.ui({ parseNetworkData: true }),
      
      // Legacy V1 format (deprecated, for backward compat)
      legacyMessages: messageList.get.all.v1(),
      
      // Raw V2 format (for advanced users)
      messagesV2: result.messagesV2,
    };
  } catch (error) {
    return handleError(error, 'Error getting messages');
  }
}
```

#### 2.2 Agent Stream Handler Updates

**File**: `packages/server/src/server/handlers/agents.ts`

Add response format option:

```typescript
export async function streamHandler({
  agent,
  body,
  format = 'mastra', // 'mastra' | 'aisdk-v5'
}: {
  agent: Agent;
  body: GetBody<'stream'>;
  format?: 'mastra' | 'aisdk-v5';
}) {
  // ... existing logic
  
  const result = await agent.stream(messages, {
    ...options,
    format: format === 'aisdk-v5' ? 'aisdk' : undefined,
  });
  
  return result;
}
```

### Phase 3: Client SDK Updates

#### 3.1 React SDK Simplification

**File**: `client-sdks/react/src/lib/ai-sdk/memory/resolveInitialMessages.ts`

```typescript
// DEPRECATED - Network data parsing now handled by MessageList
// This file can be removed in next major version

export function resolveInitialMessages(messages: MastraUIMessage[]): MastraUIMessage[] {
  console.warn(
    'resolveInitialMessages is deprecated. Network data is now automatically parsed by the server.'
  );
  return messages; // Pass through, server already parsed
}
```

**File**: `client-sdks/react/src/agent/hooks.ts`

```typescript
export function useChat(props: MastraChatProps) {
  const [messages, setMessages] = useState<MastraUIMessage[]>(() => {
    // Remove resolveInitialMessages call
    return props.initializeMessages?.() || [];
  });
  
  // ... rest of implementation
}
```

#### 3.2 Client-JS Type Safety

**File**: `client-sdks/client-js/src/types.ts`

```typescript
export interface GetMemoryThreadMessagesResponse {
  /** AI SDK V4 Core format (for backward compatibility) */
  messages: CoreMessage[];
  
  /** AI SDK V5 UI format (recommended for frontend use) */
  uiMessages: UIMessage[];
  
  /** @deprecated Legacy V1 format, will be removed in v2.0 */
  legacyMessages: AiMessageType[];
  
  /** Raw V2 storage format (for advanced use cases) */
  messagesV2?: MastraMessageV2[];
}

export interface StreamOptions {
  /** Response format: 'mastra' (default) or 'aisdk-v5' */
  format?: 'mastra' | 'aisdk-v5';
}
```

### Phase 4: Documentation & Examples

#### 4.1 Quick Start Guide

**File**: `docs/src/guides/messages-and-memory/quick-start.md` (new)

```markdown
# Messages & Memory: Quick Start

## Zero-Config Usage

Mastra handles all message format conversions automatically. You don't need to manually convert messages.

### React SDK (Recommended)

```tsx
import { useChat } from '@mastra/react';

function ChatComponent() {
  const { messages, stream } = useChat({
    agentId: 'my-agent',
  });
  
  // Messages are already in AI SDK V5 UIMessage format
  // Network data, tool calls, and reasoning are automatically parsed
  
  return (
    <MessageList>
      {messages.map(msg => (
        <Message key={msg.id}>
          {msg.parts.map(part => {
            if (part.type === 'text') return <p>{part.text}</p>;
            if (part.type === 'dynamic-tool') {
              return <ToolCall tool={part} />;
            }
            // ... handle other part types
          })}
        </Message>
      ))}
    </MessageList>
  );
}
```

### Client-JS

```typescript
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: 'http://localhost:3000' });

// Get messages - automatically in AI SDK V5 format
const { uiMessages } = await client.memory
  .thread('thread-123')
  .getMessages();

// Stream with automatic format handling
const response = await client.agent('my-agent').stream({
  coreUserMessages: [{ role: 'user', content: 'Hello' }],
});

await response.processDataStream((chunk) => {
  // Chunks are validated and typed
  if (chunk.type === 'text-delta') {
    console.log(chunk.textDelta);
  }
});
```

### Raw Fetch (Advanced)

```typescript
// Get messages
const response = await fetch('/api/memory/threads/thread-123/messages');
const { uiMessages } = await response.json();

// uiMessages is already AI SDK V5 UIMessage[]
// No conversion needed!
```

## When You DO Need Manual Conversion

Only in these specific scenarios:

### 1. Server-Side Memory Queries (Direct)

```typescript
import { Memory } from '@mastra/memory';
import { MessageList } from '@mastra/core/agent';

const memory = new Memory({ storage });
const result = await memory.query({ threadId: 'thread-123' });

// result.messagesV2 is in storage format
// Convert to UI format:
const messageList = new MessageList();
messageList.add.memory(result.messagesV2);
const uiMessages = messageList.get.all.aiV5.ui();
```

### 2. Custom Storage Adapters

```typescript
class MyCustomStorage extends MemoryStorage {
  async getMessages(args: StorageGetMessagesArg) {
    const rawMessages = await this.db.query(...);
    
    // Convert your DB format to MastraMessageV2
    return rawMessages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content, // Must be ContentPart[]
      createdAt: msg.created_at,
    }));
  }
}
```

### 3. Migrating from V1 to V2

```typescript
import { convertMessages } from '@mastra/core/agent';

const v1Messages = await legacyDb.getMessages();
const v2Messages = convertMessages(v1Messages).to('MastraV2');
await memory.saveMessages({ threadId, messages: v2Messages });
```
```

#### 4.2 Format Reference Guide

**File**: `docs/src/guides/messages-and-memory/format-reference.md` (new)

```markdown
# Message Format Reference

## Format Overview

| Format | Use Case | Where Used |
|--------|----------|------------|
| **MastraMessageV2** | Storage (canonical) | Database, memory.query() |
| **AI SDK V5 UIMessage** | Frontend display | React SDK, client-js responses |
| **AI SDK V5 CoreMessage** | LLM prompts | Internal agent calls |
| **AI SDK V4 CoreMessage** | Legacy compatibility | Backward compat only |
| **MastraMessageV1** | Deprecated | Legacy systems |

## Automatic Conversions

```
Storage (V2) ──────────────────────────────────────────────┐
     │                                                      │
     │ Server Handler                                      │
     ├──────────────► AI SDK V5 UI (with network parsing)  │
     ├──────────────► AI SDK V4 Core (backward compat)     │
     └──────────────► Legacy V1 (deprecated)               │
                                                            │
Frontend receives ◄────────────────────────────────────────┘
```

## Network Data Handling

Network execution results are stored as JSON in V2, automatically parsed to `dynamic-tool` parts in V5 UI format.

**Storage (V2)**:
```json
{
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "{\"isNetwork\":true,\"toolCalls\":[...],\"finalResult\":\"...\"}"
    }
  ]
}
```

**Frontend (V5 UI)** - Automatically converted:
```json
{
  "role": "assistant",
  "parts": [
    {
      "type": "dynamic-tool",
      "toolName": "network",
      "state": "result",
      "output": "...",
      "childMessages": [...]
    }
  ]
}
```

## Working Memory

Working memory is ephemeral - injected as system messages during generation, stripped before storage.

**During Generation**:
```json
{
  "role": "system",
  "content": "Working Memory:\n{\"user_preferences\": {...}}"
}
```

**In Storage**: Not persisted (stored separately in thread metadata or resource table)
```

#### 4.3 Migration Guide

**File**: `docs/src/guides/messages-and-memory/migration-v1-to-v2.md` (new)

```markdown
# Migration Guide: V1 to V2

## Breaking Changes

### 1. `resolveInitialMessages` Removed

**Before (v1.x)**:
```tsx
import { resolveInitialMessages } from '@mastra/react';

const messages = resolveInitialMessages(apiMessages);
```

**After (v2.x)**:
```tsx
// Not needed! Server automatically parses network data
const { uiMessages } = await client.memory.thread(id).getMessages();
```

### 2. Manual `convertMessages` Rarely Needed

**Before (v1.x)**:
```typescript
const uiMessages = convertMessages(messages).to('AIV5.UI');
```

**After (v2.x)**:
```typescript
// Server API already returns uiMessages in V5 format
const { uiMessages } = await fetch('/api/memory/threads/123/messages').then(r => r.json());
```

### 3. Stream Format Option

**Before (v1.x)**:
```typescript
// Always returned Mastra chunks
const stream = await agent.stream(messages);
```

**After (v2.x)**:
```typescript
// Can request AI SDK V5 format
const stream = await agent.stream(messages, { format: 'aisdk' });
```

## Step-by-Step Migration

### React Applications

1. Update dependencies:
```bash
npm install @mastra/react@latest @mastra/client-js@latest
```

2. Remove `resolveInitialMessages`:
```diff
- import { resolveInitialMessages } from '@mastra/react';
  
  const { messages } = useChat({
    agentId: 'my-agent',
-   initializeMessages: () => resolveInitialMessages(initialMessages),
+   initializeMessages: () => initialMessages, // Already parsed by server
  });
```

3. Update message loading:
```diff
  const loadMessages = async () => {
    const { uiMessages } = await client.memory.thread(threadId).getMessages();
-   const parsed = resolveInitialMessages(uiMessages);
-   setMessages(parsed);
+   setMessages(uiMessages); // Already in correct format
  };
```

### Server-Side Applications

1. Update memory queries:
```diff
  const result = await memory.query({ threadId });
  
- const uiMessages = convertMessages(result.messages).to('AIV5.UI');
+ const messageList = new MessageList();
+ messageList.add.memory(result.messagesV2);
+ const uiMessages = messageList.get.all.aiV5.ui();
```

2. Use server handlers instead of direct memory access (recommended):
```diff
- const result = await memory.query({ threadId });
- const uiMessages = convertMessages(result.messages).to('AIV5.UI');
- return Response.json({ uiMessages });

+ import { getMessagesHandler } from '@mastra/server/handlers';
+ 
+ const result = await getMessagesHandler({ mastra, agentId, threadId });
+ return Response.json(result); // Already includes all formats
```
```

#### 4.4 Example Updates

**File**: `examples/memory-with-react/README.md` (new)

```markdown
# Memory with React Example

This example demonstrates zero-config memory usage with React.

## Key Features

- ✅ No manual message conversion
- ✅ Automatic network data parsing
- ✅ Working memory integration
- ✅ Tool call visualization
- ✅ Streaming with real-time updates

## Running the Example

```bash
npm install
npm run dev
```

## Code Walkthrough

### 1. Initialize Chat

```tsx
const { messages, stream, isRunning } = useChat({
  agentId: 'support-agent',
});
```

That's it! Messages are automatically in the correct format.

### 2. Load Previous Messages

```tsx
useEffect(() => {
  async function loadHistory() {
    const { uiMessages } = await client.memory
      .thread(threadId)
      .getMessages();
    
    setMessages(uiMessages); // Already parsed, ready to use
  }
  
  loadHistory();
}, [threadId]);
```

### 3. Display Messages

```tsx
{messages.map(msg => (
  <Message key={msg.id}>
    {msg.parts.map(part => {
      if (part.type === 'text') {
        return <p>{part.text}</p>;
      }
      
      if (part.type === 'dynamic-tool') {
        // Network execution, workflow, or tool call
        return (
          <ToolExecution
            name={part.toolName}
            state={part.state}
            output={part.output}
            childMessages={part.childMessages}
          />
        );
      }
      
      if (part.type === 'reasoning') {
        return <Reasoning>{part.reasoning}</Reasoning>;
      }
    })}
  </Message>
))}
```

## What's Happening Under the Hood

1. **Server**: Memory query returns V2 format
2. **Server Handler**: Converts V2 → V5 UI, parses network data
3. **Client**: Receives ready-to-use UIMessage[]
4. **React**: Renders without any conversion

No manual steps required!
```

### Phase 5: Testing & Validation

#### 5.1 Unit Tests

**File**: `packages/core/src/agent/message-list/tests/network-data-parsing.test.ts` (new)

```typescript
import { MessageList } from '../index';
import { MastraMessageV2 } from '../types';

describe('MessageList Network Data Parsing', () => {
  it('should parse network data from V2 text parts', () => {
    const v2Messages: MastraMessageV2[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              isNetwork: true,
              toolCalls: [{ toolName: 'search', args: {} }],
              finalResult: 'Result',
            }),
          },
        ],
        createdAt: new Date(),
      },
    ];
    
    const list = new MessageList();
    list.add.memory(v2Messages);
    const uiMessages = list.get.all.aiV5.ui({ parseNetworkData: true });
    
    expect(uiMessages[0].parts[0].type).toBe('dynamic-tool');
    expect(uiMessages[0].parts[0].toolName).toBe('network');
  });
  
  it('should preserve regular text when parseNetworkData is false', () => {
    // ... test
  });
  
  it('should handle malformed network data gracefully', () => {
    // ... test
  });
});
```

#### 5.2 Integration Tests

**File**: `packages/server/src/server/handlers/memory.integration.test.ts` (new)

```typescript
describe('Memory Handler Integration', () => {
  it('should return all message formats from getMessages', async () => {
    const result = await getMessagesHandler({
      mastra,
      agentId: 'test-agent',
      threadId: 'thread-123',
    });
    
    expect(result).toHaveProperty('messages'); // V4 Core
    expect(result).toHaveProperty('uiMessages'); // V5 UI
    expect(result).toHaveProperty('legacyMessages'); // V1
    expect(result).toHaveProperty('messagesV2'); // V2
  });
  
  it('should parse network data in uiMessages', async () => {
    // Save message with network data
    await memory.saveMessages({
      threadId: 'thread-123',
      messages: [networkMessage],
    });
    
    const result = await getMessagesHandler({
      mastra,
      agentId: 'test-agent',
      threadId: 'thread-123',
    });
    
    const uiMsg = result.uiMessages[0];
    expect(uiMsg.parts[0].type).toBe('dynamic-tool');
  });
});
```

#### 5.3 E2E Tests

**File**: `examples/memory-with-react/e2e/message-flow.spec.ts` (new)

```typescript
import { test, expect } from '@playwright/test';

test('should load and display messages without manual conversion', async ({ page }) => {
  await page.goto('/chat');
  
  // Messages should load automatically
  await expect(page.locator('[data-testid="message"]')).toHaveCount(5);
  
  // Network execution should be parsed and displayed
  await expect(page.locator('[data-testid="tool-execution"]')).toBeVisible();
  
  // Send new message
  await page.fill('[data-testid="input"]', 'Hello');
  await page.click('[data-testid="submit"]');
  
  // Stream should update UI in real-time
  await expect(page.locator('[data-testid="message"]')).toHaveCount(6);
});
```

## User Experience Flows

### Flow 1: React Developer (Zero Config)

```typescript
// 1. Install
npm install @mastra/react @mastra/client-js

// 2. Use
import { useChat } from '@mastra/react';

function Chat() {
  const { messages, stream } = useChat({ agentId: 'my-agent' });
  
  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>
          {msg.parts.map(part => {
            if (part.type === 'text') return <p>{part.text}</p>;
            if (part.type === 'dynamic-tool') return <ToolCall {...part} />;
          })}
        </div>
      ))}
    </div>
  );
}

// That's it! No conversion, no normalization, no config.
```

**What happens behind the scenes:**
1. `useChat` calls `client.memory.thread(id).getMessages()`
2. Server handler uses `MessageList` to convert V2 → V5 UI with network parsing
3. React receives ready-to-use `UIMessage[]`
4. Streaming chunks are validated and converted by `toUIMessage`

### Flow 2: Client-JS Developer (Minimal Config)

```typescript
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: process.env.MASTRA_URL });

// Get messages - already in V5 UI format
const { uiMessages } = await client.memory.thread('thread-123').getMessages();

// Stream - chunks are validated and typed
const response = await client.agent('my-agent').stream({
  coreUserMessages: [{ role: 'user', content: 'Hello' }],
});

await response.processDataStream((chunk) => {
  // TypeScript knows all possible chunk types
  if (chunk.type === 'text-delta') {
    console.log(chunk.textDelta);
  } else if (chunk.type === 'tool-call') {
    console.log(chunk.toolName, chunk.args);
  }
});

// No manual conversion needed!
```

### Flow 3: Raw Fetch Developer (Still Easy)

```typescript
// Get messages
const response = await fetch('http://localhost:3000/api/memory/threads/thread-123/messages');
const { uiMessages, messages, messagesV2 } = await response.json();

// Choose the format you need:
// - uiMessages: AI SDK V5 UI (recommended for frontend)
// - messages: AI SDK V4 Core (for backward compat)
// - messagesV2: Raw storage format (for advanced use)

// Stream
const streamResponse = await fetch('http://localhost:3000/api/agents/my-agent/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Hello' }],
    format: 'aisdk-v5', // Optional: get AI SDK V5 stream instead of Mastra chunks
  }),
});

const reader = streamResponse.body.getReader();
// Process stream...
```

### Flow 4: Server-Side Developer (Direct Memory Access)

```typescript
import { Memory } from '@mastra/memory';
import { MessageList } from '@mastra/core/agent';

const memory = new Memory({ storage });

// Query returns V2 (storage format)
const result = await memory.query({ threadId: 'thread-123' });

// Convert to UI format when needed
const messageList = new MessageList();
messageList.add.memory(result.messagesV2);

const uiMessages = messageList.get.all.aiV5.ui(); // For frontend
const coreMessages = messageList.get.all.aiV5.model(); // For LLM prompts

// Or use server handlers (recommended)
import { getMessagesHandler } from '@mastra/server/handlers';

const response = await getMessagesHandler({
  mastra,
  agentId: 'my-agent',
  threadId: 'thread-123',
});

// response includes all formats
return Response.json(response);
```

## Success Metrics

### User-Facing
- ✅ Zero GitHub issues about "validation failed" errors
- ✅ Zero questions about "when to use convertMessages"
- ✅ Positive feedback: "It just works!"
- ✅ Reduced time-to-first-message in examples

### Technical
- ✅ 100% test coverage for MessageList network parsing
- ✅ All examples updated and working
- ✅ Documentation complete and accurate
- ✅ TypeScript types prevent format mismatches
- ✅ Backward compatibility maintained (with deprecation warnings)

## Rollout Plan

### Week 1: Core Implementation
- [ ] Implement network data parsing in MessageList
- [ ] Add chunk validation
- [ ] Add format detection utility
- [ ] Write unit tests

### Week 2: Server & Client Updates
- [ ] Update memory handlers
- [ ] Update agent handlers
- [ ] Update client-js types
- [ ] Deprecate resolveInitialMessages in React SDK
- [ ] Write integration tests

### Week 3: Documentation & Examples
- [ ] Write quick start guide
- [ ] Write format reference
- [ ] Write migration guide
- [ ] Update all examples
- [ ] Write E2E tests

### Week 4: Testing & Refinement
- [ ] Run full test suite
- [ ] Test all examples
- [ ] Gather internal feedback
- [ ] Fix issues
- [ ] Prepare release notes

### Week 5: Release
- [ ] Publish beta version
- [ ] Gather community feedback
- [ ] Address issues
- [ ] Publish stable release
- [ ] Announce on Discord/Twitter

## Open Questions

1. **Backward Compatibility**: Should we maintain V1 format indefinitely, or deprecate in v2.0?
   - **Recommendation**: Deprecate in v2.0, remove in v3.0

2. **Network Data Storage**: Should we store network data in a structured field instead of JSON string?
   - **Recommendation**: Yes, but as a separate migration (breaking change)

3. **Stream Format Default**: Should we default to 'aisdk-v5' format for streams?
   - **Recommendation**: No, keep 'mastra' as default for backward compat, but document 'aisdk-v5' as recommended

4. **Auto-Detection**: Should MessageList auto-detect and parse network data always, or require opt-in?
   - **Recommendation**: Auto-parse for UI formats, opt-in for model formats

## Next Steps

1. Review this plan with the team
2. Get approval on architectural decisions
3. Create GitHub issues for each phase
4. Assign owners
5. Begin implementation

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Owner**: Engineering Team  
**Status**: Proposal

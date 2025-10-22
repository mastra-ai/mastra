# Network Data Storage Solution

## Problem Statement

Network execution results are currently stored as **JSON strings** within `text` parts of `MastraMessageV2` messages. This creates several issues:

1. **Fragile Parsing**: Frontend must detect and parse JSON strings with `part.text.includes('"isNetwork":true')`
2. **Format Mismatch**: V2 (AI SDK V4) doesn't support `dynamic-tool` parts, forcing workarounds
3. **Duplication**: Parsing logic exists only in React SDK, not available server-side or for other clients
4. **Type Safety**: JSON strings lose type information and validation

### Why JSON Stringification Was Used

From commit `65493b31c3`, network data was stringified because:
- `MastraMessageV2` is based on AI SDK V4 `UIMessage` structure
- AI SDK V4 only supports `text`, `image`, `file` parts (no `dynamic-tool`)
- No dedicated field existed for structured network metadata

## Solution: Extend MastraMessageV2 with Network Metadata

### 1. Add Network Metadata Field to MastraMessageV2

```typescript
// packages/core/src/agent/message-list/index.ts

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
  
  // NEW: Structured network execution data
  networkExecution?: NetworkExecutionMetadata;
};
```

### 2. Update Network Loop to Store Structured Data

```typescript
// packages/core/src/loop/network/index.ts (around line 565)

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
            finalResult: {
              text: finalResult.text,
              toolCalls: finalResult.toolCalls,
              messages: finalResult.messages,
            },
          }),
        },
      ],
    },
  },
});

// AFTER (proposed):
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

### 3. Update MessageList Getters to Convert Network Data

```typescript
// packages/core/src/agent/message-list/index.ts

// Add helper to convert network metadata to dynamic-tool part
private convertNetworkMetadataToDynamicTool(
  message: MastraMessageV2
): AIV5Type.UIMessage['parts'][number] | null {
  const networkExec = message.content.networkExecution;
  if (!networkExec) return null;

  const childMessages: AIV5Type.UIMessage[] = [];
  
  // Convert tool calls to child messages
  if (networkExec.finalResult?.toolCalls) {
    for (const toolCall of networkExec.finalResult.toolCalls) {
      childMessages.push({
        id: nanoid(),
        role: 'assistant',
        createdAt: message.createdAt,
        parts: [
          {
            type: 'dynamic-tool',
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            args: toolCall.args,
            result: toolCall.result,
            state: 'result-available',
          },
        ],
      });
    }
  }

  // Convert nested messages to child messages
  if (networkExec.finalResult?.messages) {
    for (const nestedMsg of networkExec.finalResult.messages) {
      childMessages.push(...this.convertV2ToV5UI([nestedMsg]));
    }
  }

  return {
    type: 'dynamic-tool',
    toolCallId: message.id,
    toolName: networkExec.primitiveType === 'agent' ? 'agent' : 'workflow',
    args: {
      primitiveId: networkExec.primitiveId,
      selectionReason: networkExec.selectionReason,
    },
    result: networkExec.finalResult?.text,
    state: 'result-available',
    childMessages: childMessages.length > 0 ? childMessages : undefined,
  };
}

// Update V2 -> V5 UI conversion
private mastraMessageV2ToMastraMessageV3(message: MastraMessageV2): MastraMessageV3 {
  const parts = [...message.content.parts];
  
  // Add network execution as dynamic-tool part
  const networkPart = this.convertNetworkMetadataToDynamicTool(message);
  if (networkPart) {
    parts.push(networkPart);
  }

  return {
    ...message,
    content: {
      format: 3,
      parts,
      // ... rest of conversion
    },
  };
}
```

### 4. Update Server Handler (No Change Needed!)

The server handler already uses `MessageList` getters, so it will automatically return properly structured V5 UI messages:

```typescript
// packages/server/src/server/handlers/memory.ts (line 401)
// This already works correctly:
uiMessages: list.get.all.aiV5.ui()
```

### 5. Deprecate Frontend Parsing

```typescript
// client-sdks/react/src/lib/ai-sdk/memory/resolveInitialMessages.ts

// BEFORE: Complex JSON parsing logic
export function resolveInitialMessages(messages: MastraUIMessage[]): MastraUIMessage[] {
  // 100+ lines of parsing...
}

// AFTER: No-op (server already returns correct format)
export function resolveInitialMessages(messages: MastraUIMessage[]): MastraUIMessage[] {
  // Network data is now properly structured by MessageList on the server
  return messages;
}
```

## Migration Strategy

### Phase 1: Backward Compatible Storage (Week 1)

1. Add `networkExecution` field to `MastraMessageV2` (optional)
2. Update network loop to write to both old (JSON string) and new (structured) formats
3. Update `MessageList` to read from either format (prefer structured, fallback to JSON)

### Phase 2: Update Consumers (Week 2)

1. Update server handlers to use new format
2. Test with React SDK, client-js, raw fetch
3. Verify E2E flows work

### Phase 3: Deprecate JSON Format (Week 3)

1. Remove JSON string writing from network loop
2. Remove JSON parsing from `MessageList`
3. Update documentation

### Phase 4: Database Migration (Week 4)

1. Create migration script to convert existing JSON strings to structured format
2. Run migration on production data
3. Verify data integrity

## Benefits

### For Users
- ✅ **Zero Config**: No manual parsing or normalization needed
- ✅ **Type Safety**: Structured data with full TypeScript support
- ✅ **Consistency**: Same format across React, client-js, raw fetch

### For Developers
- ✅ **Single Source of Truth**: `MessageList` handles all conversions
- ✅ **Maintainability**: Logic in one place, not scattered across frontend/backend
- ✅ **Extensibility**: Easy to add new network metadata fields

### For the System
- ✅ **Performance**: No JSON parsing overhead
- ✅ **Reliability**: Type-safe, validated data structures
- ✅ **Debuggability**: Structured data is easier to inspect and debug

## Testing Plan

### Unit Tests
```typescript
// packages/core/src/agent/message-list/__tests__/network-conversion.test.ts

describe('Network Metadata Conversion', () => {
  it('should convert networkExecution to dynamic-tool part', () => {
    const message: MastraMessageV2 = {
      id: '1',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'Result' }],
        networkExecution: {
          isNetwork: true,
          primitiveType: 'agent',
          primitiveId: 'my-agent',
          finalResult: {
            text: 'Result',
            toolCalls: [
              {
                toolCallId: 'tc1',
                toolName: 'search',
                args: { query: 'test' },
                result: { data: 'found' },
              },
            ],
          },
        },
      },
    };

    const list = new MessageList();
    list.add({ response: message });
    const v5Messages = list.get.all.aiV5.ui();

    expect(v5Messages[0].parts).toContainEqual(
      expect.objectContaining({
        type: 'dynamic-tool',
        toolName: 'agent',
        childMessages: expect.arrayContaining([
          expect.objectContaining({
            parts: expect.arrayContaining([
              expect.objectContaining({
                type: 'dynamic-tool',
                toolName: 'search',
              }),
            ]),
          }),
        ]),
      })
    );
  });

  it('should handle backward compatibility with JSON strings', () => {
    const message: MastraMessageV2 = {
      id: '1',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [
          {
            type: 'text',
            text: JSON.stringify({
              isNetwork: true,
              primitiveType: 'workflow',
              finalResult: { text: 'Done' },
            }),
          },
        ],
      },
    };

    const list = new MessageList();
    list.add({ response: message });
    const v5Messages = list.get.all.aiV5.ui();

    expect(v5Messages[0].parts).toContainEqual(
      expect.objectContaining({
        type: 'dynamic-tool',
        toolName: 'workflow',
      })
    );
  });
});
```

### Integration Tests
```typescript
// packages/server/src/server/handlers/__tests__/memory-network.test.ts

describe('Memory API with Network Data', () => {
  it('should return properly structured network messages', async () => {
    // Save network execution result
    await memory.saveMessages([networkMessage]);

    // Fetch via API
    const response = await fetch('/api/memory/threads/123/messages');
    const { uiMessages } = await response.json();

    // Verify structure
    expect(uiMessages[0].parts).toContainEqual({
      type: 'dynamic-tool',
      toolName: 'agent',
      childMessages: expect.any(Array),
    });
  });
});
```

### E2E Tests
```typescript
// e2e/network-execution.test.tsx

describe('Network Execution E2E', () => {
  it('should display network results correctly in React', async () => {
    const { result } = renderHook(() => useChat({ agentId: 'test' }));

    // Trigger network execution
    await act(() => result.current.sendMessage('Use agent X'));

    // Verify UI message structure
    const lastMessage = result.current.messages[result.current.messages.length - 1];
    expect(lastMessage.parts).toContainEqual({
      type: 'dynamic-tool',
      childMessages: expect.any(Array),
    });
  });
});
```

## Open Questions

1. **Database Schema**: Do we need to update the `messages` table schema to support the new `networkExecution` field?
   - **Recommendation**: If using JSONB, no schema change needed. If using typed columns, add `network_execution JSONB` column.

2. **Streaming**: Should network execution stream `network-*` chunks that `MessageList` converts in real-time?
   - **Recommendation**: Yes, add `network-execution-start/end` chunks to `ChunkType` and handle in `MessageList.addStreamPart()`.

3. **Backward Compatibility**: How long should we support reading JSON strings?
   - **Recommendation**: Support for 2 major versions (6 months), then remove.

4. **Other Structured Data**: Are there other cases where we're stringifying structured data?
   - **Action**: Audit codebase for other `JSON.stringify` in message content.

## Next Steps

1. ✅ Document the solution (this file)
2. ⏭️ Get team approval on approach
3. ⏭️ Implement Phase 1 (backward compatible storage)
4. ⏭️ Write tests
5. ⏭️ Update documentation
6. ⏭️ Roll out to production

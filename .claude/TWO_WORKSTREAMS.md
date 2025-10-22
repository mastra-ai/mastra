# Two Parallel Workstreams

## Overview

The message normalization work splits into two independent, parallel workstreams:

1. **Public API Correctness** - Ensure users get the right format without manual work
2. **Internal Architecture** - Centralize format handling in `MessageList`

These can be worked on simultaneously by different team members.

---

## Workstream 1: Public API Correctness

**Goal**: Users should receive properly formatted messages without manual normalization.

**Owner**: Backend/API team

**Timeline**: 2-3 weeks

### What Users Care About

```typescript
// React SDK
const { messages } = useChat({ agentId: 'my-agent' });
// ✅ messages are AI SDK V5 UIMessage[]
// ✅ Network data is already in dynamic-tool parts
// ✅ No parsing needed

// client-js
const { uiMessages } = await client.memory.thread('123').getMessages();
// ✅ uiMessages are AI SDK V5 UIMessage[]
// ✅ Network data is already in dynamic-tool parts
// ✅ No parsing needed

// Raw fetch
const res = await fetch('/api/memory/threads/123/messages');
const { uiMessages } = await res.json();
// ✅ uiMessages are AI SDK V5 UIMessage[]
// ✅ Network data is already in dynamic-tool parts
// ✅ No parsing needed
```

### Tasks

#### 1.1 Fix Network Data Storage (Week 1)
**File**: `packages/core/src/loop/network/index.ts`

- [ ] Add `networkExecution` field to `MastraMessageV2` type
- [ ] Update network loop to store structured data (not JSON string)
- [ ] Support backward compatibility (read from both formats)

```typescript
// BEFORE
parts: [{ type: 'text', text: JSON.stringify({ isNetwork: true, ... }) }]

// AFTER
parts: [{ type: 'text', text: finalResult.text }],
networkExecution: { isNetwork: true, selectionReason, ... }
```

#### 1.2 Update MessageList Conversion (Week 1)
**File**: `packages/core/src/agent/message-list/index.ts`

- [ ] Add `convertNetworkMetadataToDynamicTool()` helper
- [ ] Update `mastraMessageV2ToMastraMessageV3()` to convert network data
- [ ] Ensure `get.all.aiV5.ui()` returns proper dynamic-tool parts

#### 1.3 Verify Server Handlers (Week 2)
**File**: `packages/server/src/server/handlers/memory.ts`

- [ ] Confirm `getMessagesHandler` uses `list.get.all.aiV5.ui()`
- [ ] Add tests for network message responses
- [ ] Verify format is correct

#### 1.4 Deprecate Frontend Parsing (Week 2)
**File**: `client-sdks/react/src/lib/ai-sdk/memory/resolveInitialMessages.ts`

- [ ] Remove JSON parsing logic
- [ ] Make function a no-op (or remove entirely)
- [ ] Update React SDK to not call it

#### 1.5 Update Documentation (Week 3)
- [ ] Update memory API docs
- [ ] Add migration guide for users on old versions
- [ ] Update examples to show zero-config usage

### Success Criteria

- ✅ Users receive AI SDK V5 `UIMessage[]` from all APIs
- ✅ Network data is in `dynamic-tool` parts (not JSON strings)
- ✅ No manual `convertMessages()` or `resolveInitialMessages()` needed
- ✅ Works with React SDK, client-js, and raw fetch
- ✅ Zero GitHub issues about format confusion

---

## Workstream 2: Internal Architecture (MessageList)

**Goal**: Centralize all format handling in `MessageList` for maintainability.

**Owner**: Core/Agent team

**Timeline**: 2-3 weeks

### What Developers Care About

```typescript
// Loop code should just pass chunks to MessageList
const messageList = new MessageList();

// Instead of manually constructing MastraMessageV2:
messageList.add({
  response: {
    id: nanoid(),
    role: 'assistant',
    content: {
      format: 2,
      parts: [{ type: 'text', text: chunk.textDelta }],
    },
  },
});

// Should be:
messageList.addStreamPart(chunk); // MessageList handles conversion
```

### Tasks

#### 2.1 Add `addStreamPart()` Method (Week 1)
**File**: `packages/core/src/agent/message-list/index.ts`

- [ ] Create `addStreamPart(chunk: ChunkType)` method
- [ ] Handle all chunk types: `text-delta`, `reasoning-start/delta/end`, `file`, `source`, `tool-call`, etc.
- [ ] Convert chunks to `MastraMessageV2` internally
- [ ] Track streaming state (in-progress vs. completed)

```typescript
class MessageList {
  addStreamPart(chunk: ChunkType): void {
    switch (chunk.type) {
      case 'text-delta':
        this.appendTextToLastMessage(chunk.textDelta);
        break;
      case 'reasoning-start':
        this.startReasoningInLastMessage();
        break;
      case 'tool-call':
        this.addToolCallToLastMessage(chunk);
        break;
      // ... handle all chunk types
    }
  }
}
```

#### 2.2 Add Chunk Validation (Week 1)
**File**: `packages/core/src/agent/message-list/utils/validate-chunk.ts`

- [ ] Create Zod schemas for all `ChunkType` variants
- [ ] Add `validateChunk(chunk: unknown): ChunkType` function
- [ ] Throw descriptive errors for invalid chunks
- [ ] Prevent "validation failed" errors in streaming

```typescript
import { z } from 'zod';

const TextDeltaChunkSchema = z.object({
  type: z.literal('text-delta'),
  textDelta: z.string(),
});

const ToolCallChunkSchema = z.object({
  type: z.literal('tool-call'),
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.record(z.unknown()),
});

export const ChunkSchema = z.discriminatedUnion('type', [
  TextDeltaChunkSchema,
  ToolCallChunkSchema,
  // ... all chunk types
]);

export function validateChunk(chunk: unknown): ChunkType {
  return ChunkSchema.parse(chunk);
}
```

#### 2.3 Update Loop to Use `addStreamPart()` (Week 2)
**File**: `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts`

- [ ] Replace manual `MastraMessageV2` construction with `messageList.addStreamPart(chunk)`
- [ ] Remove duplicate conversion logic
- [ ] Simplify loop code

```typescript
// BEFORE (lines 82, 204, 246, 275, 293)
if (chunk.type === 'text-delta') {
  messageList.add({
    response: {
      id: nanoid(),
      role: 'assistant',
      content: {
        format: 2,
        parts: [{ type: 'text', text: chunk.textDelta }],
      },
    },
  });
}

// AFTER
messageList.addStreamPart(chunk);
```

#### 2.4 Add Format Auto-Detection (Week 2)
**File**: `packages/core/src/agent/message-list/utils/detect-format.ts`

- [ ] Create `detectMessageFormat(message: unknown)` function
- [ ] Use heuristics to identify V1, V2, V3, AI SDK V4, AI SDK V5
- [ ] Add `autoConvert(messages: unknown[], targetFormat: 'v5-ui')` helper

```typescript
export function detectMessageFormat(message: unknown): 'v1' | 'v2' | 'v3' | 'ai-v4' | 'ai-v5' | 'unknown' {
  if (!message || typeof message !== 'object') return 'unknown';
  
  const msg = message as any;
  
  // V3 has content.format === 3
  if (msg.content?.format === 3) return 'v3';
  
  // V2 has content.format === 2
  if (msg.content?.format === 2) return 'v2';
  
  // V1 has content as string or array
  if (typeof msg.content === 'string' || Array.isArray(msg.content)) return 'v1';
  
  // AI SDK V5 has parts array with specific types
  if (Array.isArray(msg.parts) && msg.parts.some((p: any) => p.type === 'dynamic-tool')) return 'ai-v5';
  
  // AI SDK V4 has parts array
  if (Array.isArray(msg.parts)) return 'ai-v4';
  
  return 'unknown';
}

export function autoConvert(messages: unknown[], targetFormat: 'v5-ui'): AIV5Type.UIMessage[] {
  const list = new MessageList();
  
  for (const msg of messages) {
    const format = detectMessageFormat(msg);
    
    switch (format) {
      case 'v1':
        list.add({ response: convertV1ToV2(msg) });
        break;
      case 'v2':
        list.add({ response: msg as MastraMessageV2 });
        break;
      case 'v3':
        list.add({ response: convertV3ToV2(msg) });
        break;
      case 'ai-v4':
        list.add({ response: convertAIV4ToV2(msg) });
        break;
      case 'ai-v5':
        return messages as AIV5Type.UIMessage[];
      default:
        throw new Error(`Unknown message format: ${JSON.stringify(msg)}`);
    }
  }
  
  return list.get.all.aiV5.ui();
}
```

#### 2.5 Add Comprehensive Tests (Week 3)
**Files**: `packages/core/src/agent/message-list/__tests__/`

- [ ] Test `addStreamPart()` for all chunk types
- [ ] Test chunk validation (valid and invalid)
- [ ] Test network metadata conversion
- [ ] Test format auto-detection
- [ ] Test backward compatibility (JSON strings)

### Success Criteria

- ✅ Loop code uses `messageList.addStreamPart(chunk)`
- ✅ No manual `MastraMessageV2` construction in loop
- ✅ All format conversion logic in `MessageList`
- ✅ Chunk validation prevents streaming errors
- ✅ Auto-detection handles mixed format inputs
- ✅ 100% test coverage for new methods

---

## Dependencies Between Workstreams

### Workstream 1 depends on Workstream 2:
- **Network metadata conversion** (2.1 partial) must be done for public API to work

### Workstream 2 depends on Workstream 1:
- **Network data structure** (1.1) must be defined before `addStreamPart()` can handle it

### Recommended Approach

**Week 1**: Both teams work on foundations
- WS1: Add `networkExecution` field, update network loop
- WS2: Add `addStreamPart()` method, chunk validation

**Week 2**: Integration
- WS1: Verify server handlers, deprecate frontend parsing
- WS2: Update loop to use `addStreamPart()`, add auto-detection

**Week 3**: Polish
- WS1: Documentation and examples
- WS2: Comprehensive tests

---

## Communication Points

### Daily Standups
- Share progress on each workstream
- Identify blockers or dependencies
- Coordinate integration points

### Code Reviews
- WS1 reviews WS2's `MessageList` changes
- WS2 reviews WS1's API changes
- Ensure consistency

### Testing
- WS1 writes E2E tests for user flows
- WS2 writes unit tests for `MessageList`
- Both teams review integration tests

---

## Rollout Strategy

### Phase 1: Internal (Week 1-2)
- Implement both workstreams
- Test internally
- No user-facing changes yet

### Phase 2: Beta (Week 3)
- Deploy to staging
- Test with select users
- Gather feedback

### Phase 3: Production (Week 4)
- Deploy to production
- Monitor for issues
- Update documentation

### Phase 4: Deprecation (Week 5-6)
- Deprecate old methods (`resolveInitialMessages`, manual `convertMessages`)
- Add migration warnings
- Plan removal for next major version

---

## Success Metrics

### Workstream 1 (Public API)
- Zero GitHub issues about format confusion
- Positive user feedback on ease of use
- All examples use zero-config approach

### Workstream 2 (Internal Architecture)
- Loop code is 50% shorter (less manual conversion)
- All format logic in `MessageList` (single source of truth)
- 100% test coverage for new methods

### Overall
- No breaking changes for existing users
- Smooth migration path
- Clear, comprehensive documentation

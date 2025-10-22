# Message Format Unification Plan

## Executive Summary

Unify message format handling across Mastra by adding a single `format` parameter to memory queries, eliminating the need for manual `convertMessages()` calls and reducing confusion around multiple message formats.

## Core Principle

**"Mastra Format by Default, AI SDK on Demand"**

- **Always default to `Mastra.V2`** for all contexts (memory queries, server handlers, internal agent use)
- Exception: `ai-sdk` compatibility package defaults to AI SDK formats
- Explicit opt-in for AI SDK formats when needed
- Single source of truth for format conversion (`MessageList`)

---

## Problem Statement

### Current Pain Points

1. **Format Confusion** - Users don't know which format to use when
2. **Manual Conversion** - Requires explicit `convertMessages(result.messagesV2).to('AIV5.UI')` calls
3. **Multiple Return Fields** - APIs return `{ messages, uiMessages, legacyMessages }` causing confusion
4. **Inconsistent Defaults** - Some places default to V1, others to V2, others to V5
5. **Documentation Gaps** - Unclear when/why to use each format

### User Feedback (from GitHub)

- "I'm confused about when to use `convertMessages`"
- "Getting `validation failed` errors with workflow chunks"
- "AI SDK V5 integration is unclear"
- "Documentation is outdated/incomplete"

---

## Solution Architecture

### Format Keys

```typescript
export type MessageFormat = 
  | 'mastra-db'      // Default - internal storage format V2 (no conversion)
  | 'mastra-model'   // Legacy V1 format (only via convertMessages)
  | 'aiv4-ui'        // AI SDK v4 UIMessage (frontend)
  | 'aiv4-core'      // AI SDK v4 CoreMessage (LLM calls)
  | 'aiv5-ui'        // AI SDK v5 UIMessage (frontend)
  | 'aiv5-model';    // AI SDK v5 ModelMessage (LLM calls)
```

**Why these keys?**
- Simplified, lowercase format for consistency
- Self-documenting (platform + purpose)
- Type-safe and discoverable

### Default Behavior

**All contexts default to `mastra-db`:**
- `memory.query()` → `mastra-db`
- `memory.rememberMessages()` → `mastra-db`
- Server API handlers → `mastra-db`
- Internal agent code → `mastra-db`
- `client-js` → `mastra-db`
- React SDK → Explicitly requests `aiv5-ui` from `client-js`

**Exception:**
- `ai-sdk` compatibility package → AI SDK formats (as needed for compatibility)

**Why `mastra-db` everywhere?**
1. **Consistent behavior across all APIs** - no surprises
2. **Performance** - no conversion overhead for internal operations
3. **Explicit opt-in for AI SDK** - users who need AI SDK formats know to request them
4. **Clear intent** - `mastra-db` signals "database/storage format"

**Note on V1 (`mastra-model`):**
- V1 format is only supported via `convertMessages().to('mastra-model')`
- Not available as a `format` parameter in `query()` or API handlers
- This is a breaking change - V1 is fully deprecated

---

## Implementation Plan

### Phase 1: Memory Package Enhancement

**File:** `packages/memory/src/index.ts`

#### 1.1 Add `format` Parameter to `query()`

```typescript
// Current
async query({
  threadId,
  selectBy,
  // ... other options
}: {
  threadId: string;
  selectBy?: { last?: number; vectorSearchString?: string };
  // ...
}): Promise<{
  messages: MastraMessageV1[];
  messagesV2: MastraMessageV2[];
  uiMessages: MastraMessageV1[];
}> {
  // ... implementation
}

// New
async query({
  threadId,
  selectBy,
  format = 'mastra-db', // Default to Mastra format
  // ... other options
}: {
  threadId: string;
  selectBy?: { last?: number; vectorSearchString?: string };
  format?: MessageFormat;
  // ...
}): Promise<{
  messages: MastraMessageV2[] | AIV4.UIMessage[] | AIV4.CoreMessage[] | AIV5.UIMessage[] | AIV5.ModelMessage[];
}> {
  // Fetch from storage (always V2)
  const messagesV2 = await this.storage.getMessages({ threadId, ...selectBy });
  
  // Convert to requested format using MessageList
  const messageList = new MessageList().add(messagesV2, 'memory');
  
  let messages: unknown[];
  switch (format) {
    case 'mastra-db':
      messages = messageList.get.all.v2();
      break;
    case 'aiv4-ui':
      messages = messageList.get.all.aiV4.ui();
      break;
    case 'aiv4-core':
      messages = messageList.get.all.aiV4.core();
      break;
    case 'aiv5-ui':
      messages = messageList.get.all.aiV5.ui();
      break;
    case 'aiv5-model':
      messages = messageList.get.all.aiV5.model();
      break;
  }
  
  return { messages };
}
```

#### 1.2 Update `rememberMessages()` (Internal Use)

```typescript
async rememberMessages({
  threadId,
  resourceId,
  vectorMessageSearch,
  memoryConfig,
  format = 'mastra-db', // Default for internal use
}: {
  threadId: string;
  resourceId?: string;
  vectorMessageSearch?: string;
  memoryConfig?: MemoryConfig;
  format?: MessageFormat;
}): Promise<MastraMessageV2[] | AIV4.UIMessage[] | /* ... */> {
  // ... existing logic
  
  // Convert to requested format before returning
  const messageList = new MessageList().add(allMessages, 'memory');
  return this.convertToFormat(messageList, format);
}
```

---

### Phase 2: Server Handler Updates

**File:** `packages/server/src/server/handlers/memory.ts`

#### 2.1 Simplify `getMessagesHandler`

```typescript
// Current
export async function getMessagesHandler({
  mastra,
  agentId,
  threadId,
  limit,
  runtimeContext,
}: MemoryContext & { limit?: number }) {
  const result = await memory.query({
    threadId: threadId!,
    ...(limit && { selectBy: { last: limit } }),
  });
  const uiMessages = convertMessages(result.messagesV2).to('AIV5.UI');
  return { messages: result.messages, uiMessages, legacyMessages: result.uiMessages };
}

// New
export async function getMessagesHandler({
  mastra,
  agentId,
  threadId,
  limit,
  format = 'mastra-db', // Default to Mastra format
  runtimeContext,
}: MemoryContext & { 
  limit?: number;
  format?: MessageFormat;
}) {
  const memory = await getMemoryFromContext({ mastra, agentId, runtimeContext });
  
  const result = await memory.query({
    threadId: threadId!,
    format, // Pass through format
    ...(limit && { selectBy: { last: limit } }),
  });

  // Single return value - no more confusion
  return { messages: result.messages };
}
```

**Note:** Handlers also default to `mastra-db` for consistency. Frontend clients explicitly request `aiv5-ui` when needed.

#### 2.2 Update Route Registration

```typescript
// In packages/server/src/server/routes/memory.ts
registerApiRoute('/api/memory/threads/:threadId/messages', {
  method: 'GET',
  handler: async (c) => {
    const threadId = c.req.param('threadId');
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined;
    const format = (c.req.query('format') as MessageFormat) || 'mastra-db';
    
    return getMessagesHandler({
      mastra: c.get('mastra'),
      agentId: c.req.query('agentId'),
      threadId,
      limit,
      format, // Allow clients to specify format via query param
      runtimeContext: c.get('runtimeContext'),
    });
  },
});
```

---

### Phase 3: Client SDK Updates

**File:** `client-sdks/client-js/src/resources/memory-thread.ts`

#### 3.1 Update `getMessages()` Type

```typescript
// Current
async getMessages({ limit }: { limit?: number } = {}): Promise<{
  messages: CoreMessage[];
  uiMessages: UIMessage[];
  legacyMessages: AiMessageType[];
}> {
  const response = await this.client.get(
    `/api/memory/threads/${this.threadId}/messages`,
    { limit }
  );
  return response;
}

// New
async getMessages({ 
  limit,
  format = 'mastra-db', // Default to Mastra format
}: { 
  limit?: number;
  format?: MessageFormat;
} = {}): Promise<{
  messages: UIMessage[] | CoreMessage[] | MastraMessageV2[] | /* ... */;
}> {
  const response = await this.client.get(
    `/api/memory/threads/${this.threadId}/messages`,
    { limit, format }
  );
  return response;
}
```

**File:** `client-sdks/client-js/src/types.ts`

```typescript
// Current
export interface GetMemoryThreadMessagesResponse {
  messages: CoreMessage[];
  uiMessages: UIMessage[];
  legacyMessages: AiMessageType[];
}

// New
export interface GetMemoryThreadMessagesResponse {
  messages: UIMessage[] | CoreMessage[] | MastraMessageV2[] | ModelMessage[];
}
```

---

### Phase 4: React SDK Updates

**File:** `client-sdks/react/src/agent/hooks.ts`

#### 4.1 Simplify `useChat` Initialization

```typescript
// Current
const [messages, setMessages] = useState<MastraUIMessage[]>(
  initializeMessages ? resolveInitialMessages(initializeMessages()) : []
);

// New (client explicitly requests aiv5-ui)
const [messages, setMessages] = useState<MastraUIMessage[]>(
  initializeMessages ? initializeMessages() : []
);
// Note: client-js will request format: 'aiv5-ui' when calling getMessages()
```

**File:** `client-sdks/react/src/lib/ai-sdk/memory/resolveInitialMessages.ts`

#### 4.2 Deprecate `resolveInitialMessages`

```typescript
/**
 * @deprecated No longer needed - server now returns messages in AIV5.UI format by default.
 * This function will be removed in a future version.
 * 
 * If you need to parse network data, use the server's format parameter instead:
 * ```typescript
 * const { messages } = await client.memory.thread(threadId).getMessages({ format: 'AIV5.UI' });
 * ```
 */
export function resolveInitialMessages(messages: MastraUIMessage[]): MastraUIMessage[] {
  console.warn('resolveInitialMessages is deprecated and will be removed in a future version');
  return messages;
}
```

---

### Phase 5: Internal Agent Updates

**File:** `packages/core/src/agent/workflows/prepare-stream/prepare-memory-step.ts`

#### 5.1 Specify Format for Internal Use

```typescript
// Line 169
const memoryMessages = await capabilities.getMemoryMessages({
  resourceId,
  threadId: threadObject.id,
  vectorMessageSearch: new MessageList().add(options.messages, `user`).getLatestUserContent() || '',
  memoryConfig,
  runtimeContext,
  format: 'mastra-db', // Explicit - agent works with V2 internally
});
```

---

## Usage Examples

### 1. Frontend (React SDK with `useChat`)

```typescript
import { useChat } from '@mastra/react';

function ChatComponent() {
  const { messages, sendMessage } = useChat({
    agentId: 'my-agent',
    threadId: 'thread-123',
    // Messages need to be requested in AIV5.UI format
    initializeMessages: async () => {
      const { messages } = await client.memory
        .thread('thread-123')
        .getMessages({ format: 'AIV5.UI' }); // Explicit format request
      return messages;
    },
  });
  
  // messages is MastraUIMessage[] (AIV5.UIMessage)
}
```

### 2. Frontend (client-js)

```typescript
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: 'http://localhost:3000' });

// Get messages in mastra-db format (default)
const { messages } = await client.memory
  .thread('thread-123')
  .getMessages(); // Returns MastraMessageV2[]

// Explicitly request AI SDK V5 format for frontend
const { messages: uiMessages } = await client.memory
  .thread('thread-123')
  .getMessages({ format: 'aiv5-ui' }); // Returns AIV5.UIMessage[]
```

### 3. Server-Side (Direct Memory Usage)

```typescript
import { Memory } from '@mastra/memory';

const memory = new Memory({ storage, vector, embedder });

// Default: mastra-db (no conversion overhead)
const { messages } = await memory.query({ 
  threadId: 'thread-123' 
}); // Returns MastraMessageV2[]

// Explicit format for AI SDK integration
const { messages: uiMessages } = await memory.query({ 
  threadId: 'thread-123',
  format: 'aiv5-ui' 
}); // Returns AIV5.UIMessage[]
```

### 4. API Route Handler

```typescript
import { registerApiRoute } from '@mastra/core/server';
import { getMessagesHandler } from '@mastra/server/handlers/memory';

registerApiRoute('/api/custom/messages/:threadId', {
  method: 'GET',
  handler: async (c) => {
    const threadId = c.req.param('threadId');
    const format = c.req.query('format') as MessageFormat || 'mastra-db';
    
    return getMessagesHandler({
      mastra: c.get('mastra'),
      threadId,
      format, // Pass through from query param
    });
  },
});

// Client can call: GET /api/custom/messages/thread-123?format=aiv4-core
```

### 5. Raw Fetch (No SDK)

```typescript
// Default (mastra-db from server handler)
const response = await fetch('/api/memory/threads/thread-123/messages');
const { messages } = await response.json(); // MastraMessageV2[]

// Explicit format via query param for frontend
const response = await fetch('/api/memory/threads/thread-123/messages?format=aiv5-ui');
const { messages } = await response.json(); // AIV5.UIMessage[]
```

---

## Migration Guide

### For Users Currently Using `convertMessages()`

```typescript
// OLD
const result = await memory.query({ threadId: 'thread-123' });
const uiMessages = convertMessages(result.messagesV2).to('AIV5.UI');

// NEW
const { messages } = await memory.query({ 
  threadId: 'thread-123',
  format: 'aiv5-ui' 
});
```

### For Users Using `client-js`

```typescript
// OLD
const { uiMessages } = await client.memory.thread('thread-123').getMessages();

// NEW
const { messages } = await client.memory.thread('thread-123').getMessages({ 
  format: 'aiv5-ui' 
});
// Explicitly request aiv5-ui format for frontend use
```

### For Users Using React SDK

```typescript
// OLD
import { resolveInitialMessages } from '@mastra/react/lib/ai-sdk/memory';

const messages = resolveInitialMessages(await fetchMessages());

// NEW
const { messages } = await client.memory.thread('thread-123').getMessages({ 
  format: 'aiv5-ui' 
});
// No resolveInitialMessages needed - explicitly request aiv5-ui format
```

---

## Default Format Summary

| Context | Default Format | Override Example |
|---------|---------------|------------------|
| `memory.query()` | `mastra-db` | `format: 'aiv5-ui'` |
| `memory.rememberMessages()` | `mastra-db` | `format: 'aiv4-core'` |
| Server API handlers | `mastra-db` | `format: 'aiv5-ui'` |
| `client-js` | `mastra-db` | `getMessages({ format: 'aiv5-ui' })` |
| React SDK | Explicitly requests `aiv5-ui` | N/A |
| Internal agent code | `mastra-db` | N/A |
| `ai-sdk` package | AI SDK formats | N/A |

---

## Benefits

### For Users

1. **Zero Config** - Works out of the box for most use cases
2. **No Manual Conversion** - Format handled automatically
3. **Single Return Value** - No more `{ messages, uiMessages, legacyMessages }` confusion
4. **Explicit When Needed** - Can override format for specific use cases
5. **Consistent API** - Same pattern everywhere

### For Maintainers

1. **Centralized Logic** - All conversion in `MessageList`
2. **Type Safety** - Single source of truth for format keys
3. **Easier Testing** - Clear input/output contracts
4. **Better Documentation** - Self-documenting format keys
5. **Reduced Complexity** - Fewer code paths

---

## Testing Strategy

### Unit Tests

**Location:** `packages/core/src/agent/message-list/__tests__/`

1. **Format conversion (`format-conversion.test.ts`)**
   - Test all format keys: `mastra-db`, `aiv4-ui`, `aiv4-core`, `aiv5-ui`, `aiv5-model`
   - Test default format is `mastra-db`
   - Test invalid format throws descriptive error
   - Test round-trip conversion (V2 → format → V2)
   - Test edge cases: empty messages, messages with all part types

2. **Network data parsing (`network-parsing.test.ts`)**
   - Test parsing embedded JSON network data from V2 text parts
   - Test reconstruction of `dynamic-tool` parts with `childMessages`
   - Test handling malformed network JSON
   - Test network data is NOT parsed for non-UI formats (V2, V4.Core)
   - Test network data IS parsed for UI formats (V5.UI, V4.UI)

3. **MessageList getters (`getters.test.ts`)**
   - Test `get.all.v2()` returns raw V2
   - Test `get.all.aiV5.ui()` returns V5 UI with network data parsed
   - Test `get.all.aiV4.core()` returns V4 Core without network parsing
   - Test `get.remembered.*` vs `get.all.*` filtering

**Location:** `packages/memory/src/__tests__/`

4. **Memory query format parameter (`query-format.test.ts`)**
   - Test `memory.query({ format: 'mastra-db' })`
   - Test `memory.query({ format: 'aiv5-ui' })`
   - Test `memory.query()` defaults to `mastra-db`
   - Test format parameter with vector search
   - Test format parameter with pagination
   - Test format parameter with message filtering

5. **Memory rememberMessages format (`remember-format.test.ts`)**
   - Test `rememberMessages({ format: 'mastra-db' })`
   - Test `rememberMessages({ format: 'aiv5-ui' })`
   - Test default format is `mastra-db`
   - Test with lastMessages + semanticRecall

### Integration Tests

**Location:** `packages/server/src/__tests__/handlers/`

6. **Server handler format parameter (`memory-handler.test.ts`)**
   - Test `GET /api/memory/threads/:id/messages` defaults to `mastra-db`
   - Test `GET /api/memory/threads/:id/messages?format=aiv5-ui`
   - Test `GET /api/memory/threads/:id/messages?format=aiv4-core`
   - Test invalid format returns 400 with helpful error
   - Test response type matches requested format
   - Test with pagination, filtering, vector search

7. **Agent prepare-memory-step (`prepare-memory.test.ts`)**
   - Test agent memory fetching uses `mastra-db` by default
   - Test agent can override format if needed
   - Test memory messages are correctly added to MessageList

**Location:** `client-sdks/client-js/src/__tests__/`

8. **client-js format handling (`memory-thread.test.ts`)**
   - Test `getMessages()` defaults to `mastra-db`
   - Test `getMessages({ format: 'aiv5-ui' })`
   - Test type safety: return type matches format parameter
   - Test error handling for invalid format

**Location:** `client-sdks/react/src/__tests__/`

9. **React SDK useChat (`useChat.test.ts`)**
   - Test `initializeMessages` with `aiv5-ui` format request
   - Test messages state is correctly typed as `MastraUIMessage[]`
   - Test streaming updates work with initialized messages
   - Test no manual conversion needed

### E2E Tests

**Location:** `examples/__tests__/e2e/`

10. **Full stack message flow (`message-flow.e2e.test.ts`)**
    - Save messages via agent → query with `mastra-db` → verify structure
    - Save messages via agent → query with `aiv5-ui` → verify network data parsed
    - Save messages via agent → stream new response → verify MessageList integration
    - Test React app: initialize messages → send message → verify state updates

11. **Format consistency (`format-consistency.e2e.test.ts`)**
    - Test same thread queried with different formats returns equivalent data
    - Test V2 → V5 → V2 round-trip preserves data
    - Test network execution data survives round-trip

### Performance Tests

**Location:** `packages/core/src/__tests__/performance/`

13. **Format conversion performance (`conversion-perf.test.ts`)**
    - Benchmark V2 → V5.UI conversion with 1k messages
    - Benchmark network data parsing overhead
    - Verify `mastra-db` default has zero conversion cost
    - Compare format parameter vs manual `convertMessages()`

---

## Documentation Plan

### New Documentation

**Location:** `docs/memory/`

1. **Message Formats Guide (`message-formats.md`)**
   - Overview of all message formats (V1, V2, V4.UI, V4.Core, V5.UI, V5.Model)
   - When to use each format
   - Format comparison table with examples
   - Migration path from V1 → V2
   - Common pitfalls and solutions

2. **Memory API Reference (`api-reference.md`)**
   - `memory.query()` with `format` parameter
   - `memory.rememberMessages()` with `format` parameter
   - `memory.saveMessages()`
   - All method signatures with TypeScript types
   - Return type examples for each format
   - Error handling

3. **Quick Start Guide (`quick-start.md`)**
   - Zero-config example (defaults to `Mastra.V2`)
   - Frontend example (explicit `AIV5.UI`)
   - Server-side example
   - Common patterns

**Location:** `docs/client-sdks/`

4. **client-js Memory Guide (`client-js/memory.md`)**
   - `client.memory.thread().getMessages()` API
   - Format parameter usage
   - TypeScript types and type safety
   - Error handling
   - Examples for all formats

5. **React SDK useChat Guide (`react/useChat.md`)**
   - `useChat` hook API
   - `initializeMessages` with format parameter
   - Message state management
   - Streaming integration
   - Complete example app

**Location:** `docs/guides/`

6. **Migration Guide (`migration/format-unification.md`)**
   - Migrating from manual `convertMessages()` to `format` parameter
   - Migrating from `resolveInitialMessages` (React SDK)
   - Migrating from multiple return fields to single `messages` field
   - Breaking changes and deprecations
   - Before/after code examples

7. **Troubleshooting Guide (`troubleshooting/message-formats.md`)**
   - "validation failed" errors with streaming
   - Type errors with message formats
   - Network data not displaying correctly
   - Performance issues with large message lists
   - Common mistakes and solutions

### Documentation Updates

**Files to update:**

1. **`docs/memory/README.md`**
   - Add `format` parameter to all examples
   - Update default behavior section
   - Add link to new Message Formats Guide

2. **`docs/agent/README.md`**
   - Update memory integration examples
   - Show `format` parameter usage in agent context

3. **`docs/streaming/README.md`**
   - Clarify streaming format (Mastra ChunkType)
   - Explain client-side conversion to UIMessage
   - Link to Message Formats Guide

4. **`README.md` (root)**
   - Update quick start examples
   - Add note about `format` parameter

5. **`client-sdks/client-js/README.md`**
   - Update all memory examples
   - Add format parameter to API docs

6. **`client-sdks/react/README.md`**
   - Update `useChat` examples
   - Deprecate `resolveInitialMessages`
   - Add migration note

7. **`packages/memory/README.md`**
   - Complete rewrite with `format` parameter
   - Add all format examples
   - Update API reference

8. **`packages/core/src/storage/README.md`**
   - Clarify storage format is always `Mastra.V2`
   - Explain format conversion happens at query time

### Example Updates

**Files to update:**

1. **`examples/ai-elements/app/page.tsx`**
   - Update `useChat` to explicitly request `AIV5.UI`
   - Remove any manual conversion code

2. **`examples/*/` (all example apps)**
   - Audit all memory usage
   - Update to use `format` parameter
   - Remove manual `convertMessages()` calls
   - Add comments explaining format choices

3. **Create new examples:**
   - `examples/memory-formats/` - Demonstrates all format options
   - `examples/memory-migration/` - Before/after migration example

### API Documentation (OpenAPI/TypeDoc)

1. **Update OpenAPI specs (`packages/server/src/openapi/`)**
   - Add `format` query parameter to memory endpoints
   - Update response schemas for each format
   - Add examples for each format

2. **Update JSDoc comments**
   - `packages/memory/src/index.ts` - Add `@param format` docs
   - `packages/core/src/agent/message-list/index.ts` - Document format getters
   - `client-sdks/client-js/src/resources/memory-thread.ts` - Add format param docs

### Documentation Checklist

- [ ] Write all new documentation files
- [ ] Update all existing documentation files
- [ ] Update all example apps
- [ ] Update OpenAPI specs
- [ ] Update JSDoc comments
- [ ] Add inline code comments for complex conversions
- [ ] Create visual diagrams for format flow
- [ ] Record video walkthrough (optional)
- [ ] Review all docs for accuracy
- [ ] Test all code examples

---

## Rollout Plan

### Phase 1: Core Implementation
- [ ] Add `format` parameter to `Memory.query()`
- [ ] Add `format` parameter to `Memory.rememberMessages()`
- [ ] Update `MessageList` to handle all conversions
- [ ] Add network data parsing to `MessageList`
- [ ] Add unit tests for format conversion
- [ ] Add unit tests for network data parsing

### Phase 2: Server Updates
- [ ] Update `getMessagesHandler` to use `format` parameter
- [ ] Update route registration to accept `format` query param
- [ ] Add integration tests for handlers
- [ ] Update OpenAPI specs
- [ ] Update `prepare-memory-step` to use `Mastra.V2` default

### Phase 3: Client SDK Updates
- [ ] Update `client-js` types and methods
- [ ] Add `format` parameter to `getMessages()`
- [ ] Update TypeScript types for format-specific returns
- [ ] Deprecate `resolveInitialMessages` in React SDK
- [ ] Update `useChat` to explicitly request `AIV5.UI`
- [ ] Add E2E tests

### Phase 4: Documentation & Examples
- [ ] Write all new documentation (see Documentation Plan)
- [ ] Update all existing documentation
- [ ] Update all examples to use new API
- [ ] Create migration guide
- [ ] Create troubleshooting guide
- [ ] Review and test all documentation

### Phase 5: Testing & Validation
- [ ] Run full test suite
- [ ] Performance benchmarks
- [ ] Manual testing of all user flows
- [ ] Beta testing with select users
- [ ] Address feedback and issues

### Phase 6: Release & Communication
- [ ] Publish beta release
- [ ] Gather feedback
- [ ] Address issues
- [ ] Publish stable release with changelog
- [ ] Announce on Discord/Twitter
- [ ] Monitor GitHub issues

---

## Open Questions

### 1. Backward Compatibility ✅ **ANSWERED**

**Decision:** This is a breaking change - no backward compatibility needed.

**Rationale:**
- Project is making a major version bump
- Clean break allows for better architecture
- No need to support deprecated APIs

---

### 2. V1 Format Support ✅ **ANSWERED**

**Decision:** Support V1 only via `convertMessages().to('mastra-model')`.

**Rationale:**
- V1 is fully deprecated
- Not available as a `format` parameter in `query()` or API handlers
- Users needing V1 can still use `convertMessages()` for legacy code
- Keeps new API clean and forward-looking

---

### 3. Stream Format Parameter

**Question:** Should streaming support a `format` parameter to control output format?

**Current behavior:**
- Server streams Mastra `ChunkType`
- Client-side `toUIMessage()` converts to `UIMessage`

**Options:**
- A) Add `format` parameter to streaming (e.g., `agent.stream({ format: 'AIV5.UI' })`)
- B) Keep streaming as-is (Mastra ChunkType), client-side conversion
- C) Support both streaming formats

**Recommendation:** Option B - Keep streaming as-is
- Streaming is already optimized for Mastra ChunkType
- Client-side conversion is fast and flexible
- Avoids server-side conversion overhead during streaming
- Consistent with current architecture

**Impact:**
- No changes to streaming code
- Maintains performance
- Clear separation: storage queries use `format`, streaming uses client-side conversion

---

### 4. Performance & Caching

**Question:** Should we cache converted messages to avoid repeated conversions?

**Considerations:**
- Format conversion (V2 → V5) involves parsing and restructuring
- Network data parsing adds overhead for UI formats
- Most queries are one-time (not repeated)

**Options:**
- A) Add LRU cache for converted messages
- B) No caching, convert on-demand
- C) Cache only for expensive operations (network data parsing)

**Recommendation:** Option B initially, Option C if needed
- Measure conversion performance first
- Most queries are one-time, caching may not help
- If network data parsing is slow, cache parsed results
- Avoid premature optimization

**Action items:**
- Add performance benchmarks in test suite
- Monitor production metrics after release
- Add caching if conversion takes >100ms for typical queries

---

### 5. Network Data Storage Format ✅ **ANSWERED**

**Decision:** Don't worry about this for now.

**Rationale:**
- Out of scope for current plan
- Can be addressed in future enhancement
- Current approach is functional

---

### 6. Type Safety for Format Parameter ✅ **ANSWERED**

**Decision:** Use conditional types based on format parameter.

**Implementation:**
```typescript
type QueryResult<F extends MessageFormat> = {
  messages: F extends 'mastra-db' ? MastraMessageV2[]
    : F extends 'aiv5-ui' ? UIMessage[]
    : F extends 'aiv4-core' ? CoreMessage[]
    : // ... etc
};

query<F extends MessageFormat = 'mastra-db'>(
  args: { format?: F }
): QueryResult<F>
```

**Benefits:**
- Full type safety
- IntelliSense shows correct return type
- Catches format/type mismatches at compile time

---

### 7. Error Handling for Invalid Formats ✅ **ANSWERED**

**Decision:** Throw descriptive error immediately.

**Implementation:**
```typescript
if (!isValidFormat(format)) {
  throw new Error(
    `Invalid format: "${format}". Valid formats: ${VALID_FORMATS.join(', ')}`
  );
}
```

**Benefits:**
- Fail fast, clear error messages
- Prevents silent bugs
- Easy to debug

---

## Success Metrics

### User-Facing
- Zero GitHub issues about format confusion after release
- Positive feedback on simplified API
- Reduced support questions about `convertMessages()`

### Technical
- 100% test coverage for format conversion
- All examples updated to new API
- Documentation accuracy verified
- No performance regression

---

## Related Work

- `convertMessages()` utility (existing)
- `MessageList` getters (existing)
- `toUIMessage()` streaming converter (existing)
- `resolveInitialMessages()` (to be deprecated)

---

## Summary

This plan unifies message format handling by:

1. Adding a single `format` parameter to memory queries
2. Using the same format keys as `convertMessages().to()`
3. Defaulting to `Mastra.V2` everywhere (except `ai-sdk` compatibility package)
4. Eliminating manual conversion calls
5. Simplifying return types to a single `messages` field

The result is a zero-config experience for most users, with explicit control when needed.

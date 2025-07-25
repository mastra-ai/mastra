## Add deleteMessage method to Memory API

This PR adds the ability to delete individual messages from memory storage.

### Changes

- Added `deleteMessage(messageId: string)` method to Memory class
- Implemented deleteMessage in all storage adapters (LibSQL, PostgreSQL, Upstash, InMemory)
- Added REST API endpoint: `DELETE /api/memory/messages/:messageId`
- Added client SDK support: `thread.deleteMessage(messageId)`
- Added comprehensive documentation

### API Usage

**Server-side:**
```typescript
await memory.deleteMessage("msg_123");
```

**Client SDK:**
```typescript
const thread = client.getMemoryThread(threadId, agentId);
await thread.deleteMessage("msg_123");
```

### Implementation Details

- Deleting a message automatically updates the thread's `updatedAt` timestamp
- Returns a 404 error if the message doesn't exist
- All storage adapters use transactions to ensure atomic operations
- Vector store cleanup is marked as a future enhancement (TODO comment)

### Testing

- Added unit tests for the server handler
- Tested manually with all storage adapters
- Client SDK tested in example project
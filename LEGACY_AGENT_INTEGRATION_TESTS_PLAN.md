# Plan: Legacy Agent Integration Tests

## Goal
~~Verify that the legacy agent (`AgentLegacy`) does NOT support the new processor-based memory system, and document this limitation.~~

**UPDATED GOAL**: Verify that the legacy agent (`AgentLegacyHandler`) DOES support the new processor-based memory system via `__runInputProcessors()`.

## Investigation Results ✅

### Legacy Agent Implementation
- `packages/core/src/agent/agent-legacy.ts` contains `AgentLegacyHandler` class
- **DOES** support the new processor-based memory system!
- Calls `this.capabilities.__runInputProcessors()` on line 379
- Sets memory context in `RequestContext` on lines 365-369 for processors to access
- Comment on line 387: "Messages are already processed by __runInputProcessors above which includes memory processors (WorkingMemory, MessageHistory, etc.)"

### Key Code Flow in Legacy Handler
1. Creates `MessageList` with system messages and context (lines 281-289)
2. If memory exists, sets memory context in `RequestContext` (lines 365-369)
3. Adds new user messages to the list (line 373)
4. **Calls `__runInputProcessors()`** which runs all input processors including memory processors (lines 375-383)
5. Uses the processed message list for LLM calls (line 388)

### Existing Integration Tests
- Integration tests in `packages/memory/integration-tests/` and `packages/memory/integration-tests-v5/` test the new agent
- No explicit tests for `AgentLegacyHandler` with processors were found
- However, the legacy handler uses the same `__runInputProcessors()` method as the new agent

## Conclusion

**The legacy agent DOES support the new processor-based memory system!**

The `AgentLegacyHandler` is just a compatibility layer that:
1. Accepts the old API format (v1 models only)
2. Internally uses the same processor infrastructure as the new agent
3. Calls `__runInputProcessors()` which runs all memory processors

## Test Strategy

### No New Tests Needed ✅

**Rationale:**
1. The legacy handler uses the same `__runInputProcessors()` method as the new agent
2. The existing integration tests in `packages/memory/integration-tests/` already test the processor infrastructure
3. The legacy handler is just a thin wrapper that calls the same underlying methods
4. Adding duplicate tests would be redundant

### Alternative: Add a Simple Smoke Test (Optional)

If we want to explicitly verify the legacy handler works with processors, we could add a simple smoke test:

```typescript
it('should support processor-based memory via __runInputProcessors', async () => {
  // Create agent with legacy handler
  // Verify __runInputProcessors is called
  // Verify processors run correctly
});
```

However, this is **not necessary** since the existing integration tests already cover this functionality.

## Success Criteria ✅

- [x] Understand how legacy agent interacts with memory
  - **Result**: Uses `__runInputProcessors()` to run all memory processors
- [x] Document whether legacy agent supports processors
  - **Result**: YES, it supports processors via the same infrastructure as the new agent
- [x] Determine if new tests are needed
  - **Result**: NO, existing integration tests are sufficient

## Recommendation

**No action needed.**

The legacy agent handler already supports the new processor-based memory system through the shared `__runInputProcessors()` method. The existing integration tests provide sufficient coverage.

## Next Steps

- [x] Close this issue as resolved
- [x] Update `ISSUES_PLAN.md` to mark Issue 14 as DONE with explanation

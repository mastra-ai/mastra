# Plan: Legacy Agent Integration Tests

## Goal
Verify that the legacy agent (`AgentLegacy`) does NOT support the new processor-based memory system, and document this limitation.

## Current State

### Legacy Agent Implementation
- `packages/core/src/agent/agent-legacy.ts` uses the old memory API
- Does NOT use `InputProcessor` or `OutputProcessor`
- Uses deprecated `getMemoryMessages()` method (if it exists)

### New Agent Implementation
- `packages/core/src/agent/agent.ts` uses the new processor-based memory system
- Supports `InputProcessor` and `OutputProcessor` via `ProcessorRunner`
- Integration tests exist in `packages/memory/integration-tests/` and `packages/memory/integration-tests-v5/`

## Investigation Required

### 1. Determine Legacy Agent Memory API
- [ ] Review `packages/core/src/agent/agent-legacy.ts` to understand how it interacts with memory
- [ ] Identify which memory methods it calls (if any)
- [ ] Determine if it has any processor support

### 2. Check Existing Integration Tests
- [ ] Search for `agent-legacy` or `AgentLegacy` references in integration tests
- [ ] Verify if any existing tests cover legacy agent behavior
- [ ] Identify gaps in test coverage

## Test Strategy

### Option A: Legacy Agent Does NOT Support Processors
If the legacy agent doesn't support processors (most likely):

1. **Document the limitation**
   - Add a comment in `agent-legacy.ts` stating it doesn't support processors
   - Update any relevant documentation

2. **Add a simple test to verify the limitation**
   - Test that legacy agent doesn't have processor-related methods/properties
   - Test that it uses the old memory API (if applicable)

3. **No need for extensive integration tests**
   - The legacy agent is deprecated and will be removed
   - Focus testing efforts on the new agent

### Option B: Legacy Agent Has Partial Processor Support
If the legacy agent has some processor support:

1. **Add integration tests to verify the supported behavior**
   - Test which processors work (if any)
   - Test which processors don't work
   - Document the limitations

2. **Consider deprecation warnings**
   - Add warnings if users try to use unsupported features

## Test Scenarios (if needed)

### Scenario 1: Legacy Agent with Memory
```typescript
it('should work with basic memory (no processors)', async () => {
  // Create legacy agent with memory
  // Verify it can store and retrieve messages
  // Verify it does NOT use processors
});
```

### Scenario 2: Legacy Agent Processor Limitation
```typescript
it('should not support input/output processors', () => {
  // Verify legacy agent doesn't have processor-related properties
  // Or verify they're ignored if present
});
```

## Questions to Resolve

1. **Is the legacy agent still actively used?**
   - If yes, we need to document the processor limitation clearly
   - If no, we can skip extensive testing

2. **When will the legacy agent be removed?**
   - If soon, minimal testing is sufficient
   - If not soon, we should document the migration path

3. **Do we need migration documentation?**
   - Guide users from legacy agent to new agent
   - Explain processor benefits

## Success Criteria

- [ ] Understand how legacy agent interacts with memory
- [ ] Document whether legacy agent supports processors
- [ ] Add test(s) to verify legacy agent behavior (if needed)
- [ ] Update documentation to clarify legacy vs new agent capabilities

## Recommendation

Based on the codebase structure and the fact that we're refactoring to a processor-based architecture:

**The legacy agent likely does NOT support processors, and that's OK.**

We should:
1. Add a simple test to document this limitation
2. Focus integration testing efforts on the new agent
3. Document the migration path for users still on the legacy agent

## Next Steps

1. Review `agent-legacy.ts` implementation
2. Determine if any tests are needed
3. If yes, add minimal tests to document behavior
4. If no, update this plan with findings and close the issue

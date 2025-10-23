# Memory Leak Testing Documentation

## Status

⚠️ **Testing procedure is still being worked on** - The tests and approach documented here are part of ongoing investigation.

## Test Suite Overview

**File**: `packages/core/src/memory-leak-comprehensive.test.ts`

A comprehensive test suite that attempts to validate memory leak fixes through behavioral testing. Tests are designed to fail in the buggy state and pass only after fixes are applied.

**Note**: These tests are based on the hypothesis that buffers need to be cleared, but this approach is being reconsidered as clearing buffers may break legitimate functionality.

## Current Test Results

```
Test Files  1 failed (1)
Tests       14 failed (14)
Duration    9.74s
```

All tests currently failing, which confirms the presence of the issues being investigated.

## Test Categories

### 1. Component Tests (5 tests)

Tests that directly verify specific components:

1. **MastraModelOutput buffer retention**
   - Attempts to replay stream after completion
   - Expected: 0 chunks replayed (buffers cleared)
   - Actual: 101 chunks replayed (buffers retained)

2. **ProcessorState parts retention**
   - Adds 500 chunks, expects cleanup
   - Expected: 0 parts retained
   - Actual: 500 parts retained

3. **Multi-step workflow retention**
   - 10 steps × 100 chunks each
   - Expected: 0 total parts
   - Actual: 1000 total parts

4. **CustomState retention**
   - Adds 1000 large objects to customState
   - Expected: 0 keys after cleanup
   - Actual: 2 keys retained

5. **MessageList TypeError**
   - Passes number 4822 where message object expected
   - Tests type guard handling

### 2. Production Simulation Tests (2 tests)

Tests that simulate real-world usage patterns:

6. **Sustained load buffer accumulation**
   - 20 streams, each with 56 chunks
   - Tests buffer accumulation at scale

7. **Large payload buffer accumulation**
   - 5 streams with 80KB payloads each
   - Simulates 20k token responses

### 3. Production Error Reproduction Tests (5 tests)

Tests that reproduce exact scenarios reported:

8. **Second execution with large context OOM** (leo-paz's issue)
   - Simulates 2 workflow executions with 20k token context

9. **Sustained load without exhaustion** (Stefan's 30-minute crashes)
   - 30 agent.stream() calls simulating production load

10. **JSON serialization of accumulated buffers** (AtiqGauri, sccorby)
    - 10 streams with deeply nested complex objects

11. **MessageList type guard for malformed memory data** (Stefan's TypeError)
    - Tests handling of malformed data from Memory.query()

### 4. Pre-existing Mechanism Tests (2 tests)

Tests that validate cleanup mechanisms already in codebase:

12. **Workflow #runs Map cleanup**
    - Validates workflow cleanup after completion
    - Tests pre-existing cleanup() callback

13. **EventEmitter listener cleanup**
    - Validates listener removal with .off()
    - Tests pre-existing cleanup mechanism

## Testing Approach Considerations

### The Replay Pattern

Current tests use a "replay pattern" - attempting to read buffered data after stream completion to prove whether buffers are retained or cleared.

**Strengths**:

- Tests actual behavior rather than memory measurements
- GC-proof: Actively uses buffered data
- Precise: Counts exact chunks retained
- Consistent pass/fail across runs

**Concerns**:

- Based on assumption that buffers should be cleared
- May not reflect intended design (buffers needed for concurrent stream access)

### Alternative Testing Approaches Being Explored

1. **Reference tracking**: Test what holds references to output objects
2. **Lifecycle testing**: Verify proper garbage collection after use
3. **Load testing**: Simulate production traffic patterns
4. **Memory profiling**: Use heap snapshots to identify retention

## Real Agent Stream Testing

We've attempted to reproduce OOM with real agent.stream() calls but haven't succeeded yet, even with:

- 128MB memory limits
- 100+ sequential streams
- Large context sizes (50k+ characters)
- Concurrent stream scenarios

This suggests the issue may be more complex than simple buffer accumulation.

## Projected Impact (Based on Current Tests)

If buffers are retained as tests show:

| Scenario                    | Chunks Retained  | Memory Impact  |
| --------------------------- | ---------------- | -------------- |
| 100 agent.stream() calls    | ~5,600 chunks    | ~5-10 MB       |
| 1,000 agent.stream() calls  | ~56,000 chunks   | ~50-100 MB     |
| 10,000 agent.stream() calls | ~560,000 chunks  | ~500 MB - 1 GB |
| With 20k token responses    | 5-10x multiplier | Up to 10 GB    |

## Next Steps for Testing

1. Determine if buffer clearing is the right approach
2. Create tests that validate proper lifecycle management
3. Develop tests for reference cycle detection
4. Create production-like load simulation tests
5. Add tests for concurrent stream access patterns

## Important Note

The testing approach is evolving as we better understand the root cause. Tests may need to be rewritten once we determine the proper fix strategy.

# Future Plans

## Durable Scorer Execution on Inngest

**Status:** Planned

**Problem:** Scorers currently run fire-and-forget via `executeHook()` with `setImmediate()`. This means:
- No durability - if the process crashes, scorer execution is lost
- No visibility - can't see scorer status in Inngest dashboard
- No retries - scorer failures are silent

**Proposed Solution:** Run scorers as a **separate Inngest workflow** triggered fire-and-forget style.

### Architecture

```
Current (fire-and-forget, no durability):
  Agent workflow completes → runScorer() → setImmediate() → scorer.run()
                                            ↑
                                            Lost if process crashes

Proposed (fire-and-forget trigger, durable execution):
  Agent workflow completes → step.sendEvent('scorer.run.requested', payload)
                                            ↓
                            Separate Inngest function picks up event
                                            ↓
                            Runs scorer.run() durably with retries
                                            ↓
                            Saves to storage, exports to observability
```

### Benefits
- Main agent workflow stays fast (not blocked by scorers)
- Scorers run durably on Inngest (survives crashes, has retries)
- Full visibility in Inngest dashboard
- Decoupled - can scale scorer execution independently

### Implementation Notes
1. Create a separate Inngest function that listens for `scorer.run.requested` events
2. At end of agent workflow, use `step.sendEvent()` to trigger scorer execution
3. The scorer function resolves the scorer from Mastra and runs it
4. Results saved to storage and exported to observability as usual

### Files to Modify
- `/workflows/inngest/src/durable-agent/create-inngest-agentic-workflow.ts` - Add event emission at end
- `/workflows/inngest/src/` - New scorer execution function
- `/packages/core/src/mastra/hooks.ts` - Extract scorer execution logic for reuse

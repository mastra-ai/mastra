Fixes #18192

## Summary

When a human-in-the-loop (HITL) tool approval is declined, `@mastra/core` currently feeds the model a hard-coded English string as the tool result:

```ts
result: 'Tool call was not approved by the user'
```

This change returns a structured object instead:

```ts
result: {
  status: 'denied',
  approved: false,
  reason: typeof resumeData.reason === 'string' ? resumeData.reason : null,
}
```

## Problem

- **Not machine-readable** — consumers must string-match the exact English phrase to detect a denial
- **English-only, baked into core** — no way to localize or override
- **No channel to carry *why*** the user declined the tool call

## Changes

### Source files (3)

| File | Change |
|------|--------|
| `packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts` | Return `{ status: 'denied', approved, reason }` instead of hard-coded string |
| `packages/core/src/agent/durable/workflows/steps/tool-call.ts` | Same change for durable-agent path |
| `packages/core/src/loop/network/index.ts` | Return structured result; remove dead `toolCallDeclined` variable and English-dependent `finalText` append |

### Test files (5)

| File | Change |
|------|--------|
| `packages/core/src/loop/workflows/agentic-execution/tool-call-step.test.ts` | Update assertion to `toEqual({ status: 'denied', approved: false, reason: null })` |
| `packages/core/src/agent/__tests__/tool-approval.e2e.test.ts` | Update 2 assertions to `toMatchObject({ status: 'denied', approved: false })` |
| `packages/core/src/agent/__tests__/supervisor-integration.test.ts` | Update assertion to `toMatchObject({ status: 'denied', approved: false })` |
| `packages/core/src/agent/agent-network.test.ts` | Update string equality check to property check; update assertion to `toMatchObject` |

### Other

| File | Change |
|------|--------|
| `.changeset/strong-lizards-destroy.md` | Added changeset for `@mastra/core` (minor) |
| `packages/core/__recordings__/core-src-agent-__tests__-tool-approval.e2e/test-e3f1ad60.json` | Deleted (stale recording, will regenerate on e2e run) |
| `packages/core/__recordings__/core-src-agent-__tests__-tool-approval.e2e/test-8c4e85e3.json` | Deleted (stale recording, will regenerate on e2e run) |

## Backward compatibility

- `result` is typed as `TResult` (generic) / `unknown` — **no type changes needed**
- **No production consumers** outside these 3 files do string-specific operations on this result
- `reason` is `null` when not provided, maintaining a predictable shape

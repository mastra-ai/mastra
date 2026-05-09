---
name: debugging-difficult-bugs
description: Use early when debugging a medium or hard bug, especially when tests alone may not reveal the real runtime failure. Trigger this before extended TDD iteration when a bug involves runtime state, ordering, persistence, streaming, UI/manual reproduction, or when a red test may not fully model the issue.
---

# Debugging Difficult Bugs

Use this skill early for medium or hard bugs where normal TDD may give false confidence because the test does not fully capture the real bug.

Core idea: **instrument the actual runtime path, reproduce the real issue, then inspect append-only JSONL logs before deciding on a fix.**

## When to Use

Use this workflow near the start of debugging when any of these are true:

- The bug is medium or hard complexity, especially if it spans multiple functions, packages, processes, or UI/runtime boundaries.
- A test is red, but the failing test might be an incomplete model of the real bug.
- You are tempted to make a second speculative fix without new runtime evidence.
- The bug depends on runtime ordering, state, caching, streaming, concurrency, persistence, UI interaction, or external services.
- The user says they can reproduce the issue manually.
- The test passes after a change, but you are not confident it proves the actual reported bug is fixed.

Do **not** keep iterating only on tests if you do not understand the runtime behavior.

## Required Approach

1. **State the uncertainty**
   - Acknowledge that the current test may not capture the actual bug.
   - Identify the real code path that must be observed.

2. **Add temporary unconditional instrumentation**
   - Add logs throughout the suspected code flow.
   - Logs must be unconditional: do **not** gate them behind an env var, debug flag, or log level.
   - Each log point must append one JSON object per line to a `.jsonl` file in the current working directory.
   - Include enough context to reconstruct the path: event name, timestamp, relevant ids, input shape, state transitions, branch decisions, return values, and caught errors.

3. **Reproduce the real issue**
   - Prefer to run the reproduction yourself if possible.
   - If the issue requires the user's environment or manual interaction, ask the user to reproduce it after instrumentation is added.
   - Tell the user exactly which `.jsonl` file to send or ask them to tell you when reproduction is complete so you can inspect it.

4. **Analyze the log before fixing**
   - Read the JSONL log chronologically.
   - Compare expected flow vs actual flow.
   - Identify the first point where state or behavior diverges.
   - Only then implement the fix.

5. **Clean up instrumentation**
   - Remove all temporary unconditional logs after root cause is understood and the fix is verified.
   - Do not leave debug files, log helpers, or noisy runtime logging in the final diff unless the user explicitly asks.

6. **Keep or improve tests**
   - Add or adjust a focused regression test once the real bug is understood.
   - Make the test assert the actual broken behavior discovered from logs, not the earlier incorrect assumption.

## JSONL Logging Pattern

Use append-only JSONL in `cwd` so it works across CLIs, dev servers, tests, and manual reproduction.

### Node / TypeScript

```ts
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

function debugBug(event: string, data: Record<string, unknown> = {}) {
  appendFileSync(
    join(process.cwd(), 'debug-difficult-bug.jsonl'),
    `${JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...data,
    })}\n`,
  );
}
```

Call it at every meaningful branch or state transition:

```ts
debugBug('workflow.start', { runId, stepId, inputKeys: Object.keys(input ?? {}) });

debugBug('workflow.beforeStep', {
  runId,
  stepId,
  status: step.status,
  hasResumeData: Boolean(resumeData),
});

try {
  const result = await executeStep();
  debugBug('workflow.afterStep', { runId, stepId, resultShape: Object.keys(result ?? {}) });
  return result;
} catch (error) {
  debugBug('workflow.stepError', {
    runId,
    stepId,
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
  });
  throw error;
}
```

## What to Log

Prefer compact, structured data over huge dumps.

Log:

- Function or phase name.
- Stable ids: request id, run id, thread id, resource id, step id, tool call id.
- Input/output **shape**: keys, counts, lengths, statuses.
- Branch decisions and the data that caused them.
- State before and after mutation.
- Error names/messages and relevant metadata.
- Ordering markers for async, streaming, or concurrent flows.

Avoid logging:

- API keys, auth headers, tokens, cookies, credentials.
- Full user content unless necessary and safe.
- Large payloads that make the log unreadable.
- Binary data or full model responses unless the bug requires it.

If sensitive data might appear, log redacted summaries:

```ts
debugBug('request.received', {
  hasAuthHeader: Boolean(headers.authorization),
  bodyKeys: Object.keys(body ?? {}),
  messageCount: body?.messages?.length,
});
```

## Reproduction Handoff to User

When the user needs to reproduce manually, say exactly this shape:

```text
I added temporary unconditional JSONL instrumentation. Please reproduce the issue once, then send me or point me at:

<cwd>/debug-difficult-bug.jsonl

After I inspect that log, I’ll remove the instrumentation and make the actual fix.
```

If multiple processes have different working directories, either:

- log the absolute `process.cwd()` at startup, or
- write distinct files like `debug-server-flow.jsonl`, `debug-worker-flow.jsonl`, and `debug-client-flow.jsonl`.

## Analysis Checklist

Before writing the fix, answer:

- Did the instrumented code path actually run?
- What was the expected sequence of events?
- What was the actual sequence?
- What is the first incorrect state, missing value, duplicate event, or wrong branch?
- Does the original red test capture that exact divergence?
- If not, how should the regression test change?

## Final Verification

A difficult bug is not done until:

- The real reproduction path passes.
- The regression test fails before the fix and passes after the fix, when feasible.
- Temporary unconditional instrumentation is removed.
- The final diff contains only the fix and intentional tests.
- You can explain the root cause using evidence from the JSONL log.

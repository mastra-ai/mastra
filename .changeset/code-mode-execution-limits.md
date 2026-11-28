---
'@mastra/core': minor
---

Code mode now enforces per-run execution limits, so you can bound what a single program of model-authored code may consume.

`createCodeMode()` accepts five optional limits:

- `maxCalls` caps how many `external_*` calls a program may attempt.
- `maxConcurrentCalls` caps how many run at once; extra calls queue instead of failing.
- `maxResultBytes` caps the UTF-8 size of each nested tool result.
- `maxLogBytes` and `maxLogLines` bound captured console logs when a log cap is configured. Each retained line costs at least one byte, so a byte cap also bounds the line count.

`maxCalls` and `maxResultBytes` fail the whole run with a `CodeModeLimitError` when exceeded, even if the program catches the rejection. The log caps truncate the captured logs and the program still succeeds. All five are unset by default, so existing behavior is unchanged.

The calling tool's abort signal now cancels the run: it reaches the transport and every nested `external_*` call, in-flight calls are aborted, and calls still queued behind `maxConcurrentCalls` are rejected without starting.

When a log cap is configured, core also replays the logs a transport returns through the same collector, so a custom transport that ignores the caps still yields bounded output.

```ts
const { tool } = createCodeMode({
  tools: { getTopProducts, getProductRatings },
  sandbox: new LocalSandbox(),
  timeout: 30_000,
  maxCalls: 25,
  maxConcurrentCalls: 5,
  maxResultBytes: 256_000,
  maxLogLines: 200,
})
```

Fixes #31833.

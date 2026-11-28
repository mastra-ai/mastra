---
'@mastra/core': minor
'@mastra/quickjs': minor
'@mastra/isolated-vm': minor
---

Code mode now enforces per-run execution limits, so you can bound what a single program of model-authored code may consume.

`createCodeMode()` accepts five optional limits:

- `maxCalls` caps how many `external_*` calls a program may attempt.
- `maxConcurrentCalls` caps how many run at once; extra calls queue instead of failing.
- `maxResultBytes` caps the UTF-8 size of each nested tool result.
- `maxLogBytes` and `maxLogLines` bound captured console logs.

`maxCalls` and `maxResultBytes` fail the whole run with a `CodeModeLimitError` when exceeded, even if the program catches the rejection. The log caps truncate the captured logs and the program still succeeds. All five are unset by default, so existing behavior is unchanged.

The same limits apply to every built-in transport. Captured logs are now bounded during execution by a shared collector, so a long-running or chatty program can no longer grow a transport's log buffer without bound. Custom transports keep receiving the result they returned, and core replays it through the collector when a log cap is configured.

The calling tool's abort signal now cancels the run and aborts in-flight `external_*` calls.

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

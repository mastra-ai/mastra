Adds a `processToolModelOutput` hook to the processor API. It lets a processor change what the model reads from a tool result without changing the result itself.

## Why

`processToolResult` changes the result, and that change reaches memory, message history and streamed chunks. Some processors only want to change the copy the model reads: shorten a large result, reformat it, or hide a field from the model while the app still sees the full value. Today the only way to do that is to rewrite the result for everyone, or to give each tool its own `toModelOutput`.

## What it does

- The hook receives `toolName`, `toolCallId`, `args`, `stepNumber`, `providerExecuted`, `abort`, the final `result`, and the current `modelOutput` (the tool's `toModelOutput` value, or undefined).
- It runs after every `processToolResult` and after `toModelOutput`, wherever the processor sits in the list. Output processors run in order, each seeing the previous `modelOutput`.
- The final value is stored as `providerMetadata.mastra.modelOutput`, so it persists with the message and is used on later prompts. `result` is never changed.
- It is wired into the default loop, the durable engine, provider-executed results, and background task results. Processor workflows, the server schemas and client-js accept the new `processToolModelOutput` phase.
- For a background task with the `awaited` disposition the hook runs twice: once when the result is applied to the message list, and once when the awaited result returns to the turn. Both runs start from the `toModelOutput` mapping. The docs say this and ask for hooks that give the same output on a repeat run.

## Context

#25492 (`ToolResultTokenLimiter`) is the first user. It was asked to land the processor API change on its own first, per `packages/core/AGENTS.md`. This PR is that change, without the limiter. It needs approval from a human maintainer.

## Tests

- Default loop: the next prompt reads the processor's output while the streamed result stays whole; `toModelOutput` output is passed in and processors chain in order; the hook sees the `processToolResult` rewrite even when listed before it.
- Durable tool-call step: only the model-facing copy changes; the step result and the emitted chunk keep the full value.

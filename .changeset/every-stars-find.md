---
'@mastra/react': minor
---

Added optional message-level status slots to MessageFactory.

**What changed**

MessageFactory now accepts a `status` prop with four optional, strongly-typed slots that render based on a message's metadata, keeping part renderers (like `Text`) pure:

- `Tripwire`, `Warning`, `Error` are _replacement_ slots: when `metadata.status` matches, the slot renders instead of the message parts.
- `Task` is an _adjacent_ slot: when a task-completion verdict exists, it renders alongside the parts.

The factory only surfaces metadata to the slots and never filters it (for example, it still invokes `Task` when `suppressFeedback` is true) — the consumer decides what to render or skip.

```tsx
<MessageFactory
  message={message}
  status={{
    Error: ({ text }) => <ErrorNotice>{text}</ErrorNotice>,
    Task: ({ passed, suppressFeedback }) => (suppressFeedback ? null : <TaskVerdict passed={passed} />),
  }}
  {...renderers}
/>
```

`MastraDBMessageMetadata.isTaskCompleteResult` is now typed as the `{ passed?, suppressFeedback? }` completion-verdict shape (matching `completionResult`) instead of `boolean`, so the `Task` slot resolves verdicts from either field without a cast.

Also exports a new `MessageFactoryPart` type — the exact union of part shapes MessageFactory can dispatch (the typed accumulator parts plus the runtime-only `dynamic-tool` / `tool-${string}` parts) — so consumers can type part arrays passed to MessageFactory precisely instead of using `unknown[]`.

Existing behavior is unchanged when the `status` prop is omitted.

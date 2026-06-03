---
'@mastra/core': minor
'@mastra/react': minor
---

Add a type-safe `MessageFactory` component to `@mastra/react` for rendering a `MastraDBMessage` with your own per-part components, and align its tripwire/task-verdict types with `@mastra/core`.

**@mastra/react**

`MessageFactory` provides optional, fully type-safe render functions for each kind of message part. Only the renderer matching a part's type runs, and each receives correctly narrowed props; missing renderers fall back gracefully. Runtime-only `dynamic-tool` and AI SDK v5 `tool-${string}` parts are covered by a dedicated `DynamicTool` renderer, and optional role wrappers let you frame parts per message role.

```tsx
import { MessageFactory } from '@mastra/react';

<MessageFactory
  message={message}
  Text={part => <p>{part.text}</p>}
  ToolInvocation={part => <ToolCard name={part.toolInvocation.toolName} />}
  DynamicTool={part => <ToolCard name={part.toolName} state={part.state} />}
  Data={part => <DataView type={part.type} data={part.data} />}
  roles={{ Signal: ({ children }) => <SignalFrame>{children}</SignalFrame> }}
/>;
```

It also accepts an optional `status` prop with four strongly-typed slots that render from a message's metadata while keeping part renderers pure. `Tripwire`, `Warning`, and `Error` are _replacement_ slots (rendered instead of the parts when `metadata.status` matches); `Task` is an _adjacent_ slot (rendered alongside the parts when a task-completion verdict exists). The factory only surfaces metadata to the slots and never filters it (for example, it still invokes `Task` when `suppressFeedback` is true) — the consumer decides what to render or skip. Existing behavior is unchanged when `status` is omitted.

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

The narrowed part types used by the renderers are exported so consumers can type their own components: `TextPart`, `ReasoningPart`, `FilePart`, `StepStartPart`, `ToolInvocationPart`, `SourceDocumentPart`, and `SourceUrlPart`, plus `MessageFactoryPart` (the exact union of part shapes `MessageFactory` can dispatch — the typed accumulator parts plus the runtime-only `dynamic-tool` / `tool-${string}` parts) for typing part arrays precisely instead of `unknown[]`.

`MastraDBMessageMetadata.isTaskCompleteResult` is now typed as the `{ passed?, suppressFeedback? }` completion-verdict shape (matching `completionResult`) instead of `boolean`, so the `Task` slot resolves verdicts from either field without a cast.

`TripwireMetadata` is now an alias of core's `TripwirePayload`, and the message accumulator persists the canonical shape. Two behavioral changes to persisted `metadata.tripwire`:

- The tripwire `reason` is now persisted as `tripwire.reason` (previously it was only stored in the message text part).
- The processor metadata field was renamed from `tripwire.tripwirePayload` to `tripwire.metadata` to match the canonical type.

The `MessageFactory` `Tripwire` slot receives `reason` through `props.tripwire`.

**@mastra/core**

Exported the canonical `IsTaskCompletePayload` and `TripwirePayload` types from `@mastra/core/stream` so consumers can type their own task/completion and tripwire UI against them instead of redeclaring the shapes.

```ts
import type { IsTaskCompletePayload, TripwirePayload } from '@mastra/core/stream';
```

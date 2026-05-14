### 10.3 Custom events

Tools call `requestContext.get('harness').emitCustomEvent(input)` to surface
tool-level signals (progress, partial results, telemetry). The harness validates
the input at call time and fills event and session identity fields before
dispatching. Rules:

- **Type must use a dotted prefix.** `myorg.tool.progress`, `acme.scan.matched`,
etc. The leading segment should identify the publisher; the trailing segments
are the publisher's choice.
- **Payload goes through `input.payload`** and must be JSON-serializable
(`JsonValue` — see §6.1). The harness passes it to subscribers verbatim as the
emitted event's `payload` field.
- **The harness fills in the event and session identity fields** (`id`,
`sessionId`, `timestamp`, `resourceId`, `threadId`). Tools supply only `type`
and optional `payload`. Parent-surfaced subagent copies also carry the
attribution fields defined in §10.6.
- **Built-in types are rejected at call time.** The harness validates `type`
against the built-in union (§10.2) — any exact match to a built-in event type or
any type starting with a reserved internal-prefix family (`agent_`, `tool_`,
`text_`, `message_`, `queue_`, `subagent_`, `state_`, `mode_`, `model_`,
`session_`, `token_`, `channel_`, `goal_`, `attachment_`, `display_`,
`storage_`, or the exact type `error`) throws `HarnessValidationError`. The
`HarnessCustomEventInput` type (§6.1) enforces only the dotted shape
structurally; reserved-name checks are runtime validation.

`emitCustomEvent(input)` is the only author-facing Harness v1 custom-event API.
The JavaScript input object may contain only `type` and optional `payload`;
extra top-level fields, including event identity or subagent attribution fields,
throw `HarnessValidationError`. Names such as `id`, `sessionId`, or `source`
inside `payload` remain nested JSON payload data and never override the
Harness-stamped event envelope. Raw built-in/internal event emitters remain
Harness-private and may be used only by Harness-owned tools or event adapters.
Current `writer.custom()` / `data-*` chunks are a separate agent/workflow stream
mechanism unless a v1 adapter explicitly projects them at the session event
boundary through this same validation and stamping path.

The emitted subscriber event has the `CustomEvent` shape from §10.2, intersected
with `HarnessEventBase`. Custom events go through the same ordering and replay
rules as built-in events. Subscribers should narrow by `type` and tolerate
unknown types (forward-compatibility).

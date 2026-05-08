### 10.3 Custom events

Tools call `requestContext.get('harness').emitEvent(event)` to surface tool-level signals (progress, partial results, telemetry). Rules:

- **Type must use a dotted prefix.** `myorg.tool.progress`, `acme.scan.matched`, etc. The leading segment should identify the publisher; the trailing segments are the publisher's choice.
- **The harness does not validate the payload.** Anything beyond `type` is passed through to subscribers verbatim.
- **The harness fills in the base fields** (`id`, `sessionId`, `timestamp`). Tools must not set those themselves.
- **Built-in types are reserved.** Emitting any of `agent_*`, `text_delta`, `tool_*`, `subagent_*`, `state_changed`, `mode_changed`, `model_changed`, `session_*`, `token_usage_changed`, `tool_approval_required`, `tool_suspension_required`, `question_pending`, `plan_approval_required`, `attachment_*`, `storage_error`, `goal_*`, or `error` from a tool is a contract violation. The harness does not strip them — it just ends up duplicating the harness's own emission and corrupting subscriber state.

Custom events go through the same base-field, ordering, and replay rules as built-in events. Subscribers should narrow by `type` and tolerate unknown types (forward-compatibility).

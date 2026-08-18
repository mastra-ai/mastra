---
'@mastra/mcp': minor
---

Added elicitation support on the `2026-07-28` protocol revision using the spec's multi round-trip mechanism, completing the opt-in `protocolVersion` support.

**Server** — tools keep the same promise-shaped API on both eras:

```typescript
execute: async (inputData, options) => {
  const answer = await options.mcp.elicitation.sendRequest({
    message: "What is your favorite color?",
    requestedSchema: { type: "object", properties: { color: { type: "string" } } },
  });
  // ...
};
```

On a `2026-07-28` request, the tool call first returns an `input_required` result. After the client answers, the call retries with the answer attached. The tool function re-executes from the top on each retry, so keep side effects idempotent (or place them after the last elicitation) and keep the order of `sendRequest()` calls deterministic. Legacy connections keep the existing push-based `elicitation/create` flow unchanged.

**Client** — a handler registered with `elicitation.onRequest()` now fires on both eras: on `2026-07-28` connections, embedded elicitation requests are dispatched through the same handler and the originating tool call retries automatically. The warning that elicitation only works on legacy connections is removed.

---
'@mastra/core': minor
---

A channels `toolDisplay` function now receives `approved` and `denied` events, so it owns the resolved state of its approval card instead of only the pending one.

Previously a `toolDisplay` function rendered the Approve/Deny card, but clicking a button replaced that card with the framework's built-in English message. The renderer was never consulted, so a localized approval prompt resolved into an untranslated card. Denials were permanently affected, because a denied tool never runs and emits no further event. Approvals showed the built-in message only briefly, until the resumed run edited the same message with the tool's `result`.

- Both events carry the same `toolCallId`, `toolName`, `displayName`, `argsSummary`, and `args` as the `approval` event, plus `byUser` — the display name of whoever decided, or `undefined` in a direct message.
- The fallback rule matches the `approval` event: returning `undefined`, a blank message, or `{ kind: 'stream' }` keeps the built-in resolved card. That edit is what removes the Approve and Deny buttons, so skipping it would leave the card actionable. Renderers that only handle the original four kinds keep their current behavior.
- The resolved edit is routed through your function in both streaming and static mode. String modes (`cards`, `text`, `timeline`, `grouped`, `hidden`) have no function to call and keep their existing built-in rendering unchanged.

**Before** — the card resolved into the built-in message:

```ts
toolDisplay: event => {
  if (event.kind === 'approval') {
    return { kind: 'post', message: '¿Ejecutar deleteCustomer?' };
  }
  return undefined; // on click the card became "✗ Denied by Alice"
};
```

**After** — the renderer keeps ownership through to the resting state:

```ts
toolDisplay: event => {
  if (event.kind === 'approval') {
    return { kind: 'post', message: '¿Ejecutar deleteCustomer?' };
  }
  if (event.kind === 'denied') {
    return { kind: 'post', message: `✗ Rechazado por ${event.byUser ?? 'alguien'}` };
  }
  if (event.kind === 'approved') {
    return { kind: 'post', message: '✓ Aprobado, ejecutando…' };
  }
  return undefined;
};
```

Fixes #23512.

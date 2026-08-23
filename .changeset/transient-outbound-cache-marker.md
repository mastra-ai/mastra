---
'@mastra/core': patch
---

Mark transient signals in the outbound model prompt so consumers can keep them out of their prompt-cache breakpoints.

A transient signal is delivered to the model but never persisted, so the next turn reloads a history without it. A consumer that places `cache_control` breakpoints has to keep them **behind** transient rows: a cached prefix that includes one is invalidated at the turn boundary, costing a full prefix rebuild on the first call of every turn.

Transient signals now carry `providerOptions.mastra.transient` on their text parts in the outbound prompt. Detect them there (or via `isTransientSignalMessage()` on a `MastraDBMessage`) instead of matching the rendered `<system-reminder>` tag, which also catches reminders that *are* persisted. Nothing sent to the model changes.

```ts
// In a processor that sets cache_control breakpoints, keep them behind transient
// rows so the cached prefix stays stable across turns.
const isTransient = (part: { providerOptions?: { mastra?: { transient?: boolean } } }) =>
  part.providerOptions?.mastra?.transient === true;

// `prompt` is the outbound message list (e.g. from processLLMRequest). Anchor the
// breakpoint on the newest message that carries no transient part:
for (let i = prompt.length - 1; i >= 0; i--) {
  const parts = Array.isArray(prompt[i].content) ? prompt[i].content : [];
  if (parts.some(isTransient)) continue; // leave transient rows in the uncached tail
  markCacheBreakpoint(prompt[i]);
  break;
}
```

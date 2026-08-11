---
'@mastra/playground-ui': patch
---

Improved how the chat transcript meets the composer in `ChatShell`. The dock used to sit on a flat translucent panel with a visible hard edge where it started. It now carries a masked veil that ramps in across the air above the composer and tops out behind the card, so messages dim progressively as they scroll under instead of hitting an edge. The veil never fully hides them, so you can still tell the conversation continues below the composer while you scroll.

**Migrating a `--chat-veil` override**

`--chat-veil` is now an alpha percentage, not a colour: it feeds the veil's mask instead of painting a background. A colour override lands inside `rgb(0 0 0 / …)`, produces invalid CSS and silently drops the fade, so it has to be migrated.

```tsx
// before
<ChatShell className="[--chat-veil:color-mix(in_oklab,var(--chat-surface)_70%,transparent)]" />

// after — how strong the veil ever gets
<ChatShell className="[--chat-veil:70%]" />
```

**The room above the composer moved to the dock**

`--chat-fade` is new: the band of air above the composer the veil ramps in across, `1.5rem` by default. It takes over the top half of `--chat-gutter`, which now means the room below the composer only, and `ChatShell.Content` no longer carries bottom padding of its own. Anything rendering `Content` without a `ChatShell.Dock` under it has to supply that room itself.

```tsx
<ChatShell.Content className="pb-3" />
```

---
'@mastra/playground-ui': patch
---

Improved how the chat transcript meets the composer in `ChatShell`. The dock used to sit on a flat translucent panel with a visible hard edge where it started. It now carries a masked veil that ramps in across the air above the composer and tops out behind the card, so messages dim progressively as they scroll under instead of hitting an edge. The veil never reaches full strength, so the transcript stays visible below the composer while you scroll.

Two new custom properties tune it, alongside the existing `--chat-column` and `--chat-surface`:

```tsx
<ChatShell className="[--chat-fade:1.5rem] [--chat-veil:30%]">
```

`--chat-fade` is the band of air above the composer the veil ramps in across, and `--chat-veil` is the strongest it ever gets. `--chat-gutter` now means the room below the composer only — the room above belongs to the fade band, so `ChatShell.Content` no longer carries its own bottom padding.

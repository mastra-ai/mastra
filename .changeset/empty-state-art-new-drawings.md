---
'@mastra/playground-ui': minor
---

Added four `EmptyStateArt` drawings: `filesystems` (a folder tray), `sandboxes` (a sandbox with a sandcastle), `vault` (an access vault wired to services), and `secrets` (a cryptex). `alerts` is now a phone that gets a notification, and the `models` cartridges light up in each provider's color on hover.

```tsx
<EmptyState layout="split" iconSlot={<EmptyStateArt name="sandboxes" />} titleSlot="Give your agents a sandbox" />
```

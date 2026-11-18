---
'@mastra/playground-ui': minor
---

Added four `EmptyStateArt` drawings: `filesystems` (a folder tray), `sandboxes` (a sandbox with a sandcastle), `vault` (an access vault wired to services), and `secrets` (a cryptex). `connect` is now a switchboard where accounts plug into an agent, `alerts` is a phone that gets a notification, and the `models` cartridges light up in each provider's color on hover. Every drawing now stands on a soft hatched shadow instead of a base plate, and all drawings render at the same visual size.

```tsx
<EmptyState layout="split" iconSlot={<EmptyStateArt name="sandboxes" />} titleSlot="Give your agents a sandbox" />
```

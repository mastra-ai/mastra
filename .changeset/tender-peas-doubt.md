---
'@mastra/playground-ui': minor
---

Added seven EmptyStateArt drawings for states that had no drawing yet: `requests`, `no-charges`, `disconnected`, `locked`, `rate-limited`, `server-error` and `not-a-member`. Each one rests still, plays on hover or while working, and shows its own failure. The radar dish, padlock, hourglass and turnstile turn in true 3D while they play, and stay still when reduced motion is on.

```tsx
<EmptyStateArt name="disconnected" state="failed" />
```

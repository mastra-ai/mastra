---
'@mastra/playground-ui': patch
---

Fixed keyboard shortcuts firing over and over while a key is held down. Holding `[` or ⌘B now toggles the sidebar once instead of flickering it open and closed.

`useKeydown` handlers now run once per press. Pass `repeat: true` to keep firing while the key is held, for example for arrow-key navigation:

```tsx
useKeydown({ ArrowDown: selectNext, ArrowUp: selectPrevious }, { repeat: true });
```

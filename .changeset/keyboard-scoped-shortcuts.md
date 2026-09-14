---
'@mastra/playground-ui': minor
---

Added `KeyboardShortcutsProvider` and `KeyboardScope` so shortcuts declared inside a scope override the same shortcuts declared higher in the tree, and are removed as soon as the scoped component unmounts. The provider owns a single `window` listener and a single sequence state, so a sequence like `g` then `t` can resolve to a global handler in one place and to a page-specific handler in another without both firing.

**Before**: two `useKeydown` calls binding the same keys both fired.

**After**:

```tsx
// App root
<KeyboardShortcutsProvider>
  <GlobalShortcuts /> {/* useKeydown({ 'g$+t': () => navigate('/traces') }) */}
  <Routes />
</KeyboardShortcutsProvider>

// Agent page: wins over the global binding while mounted
<KeyboardScope>
  <AgentShortcuts /> {/* useKeydown({ 'g$+t': () => navigate(`/agents/${id}/traces`) }) */}
</KeyboardScope>
```

`useKeydown` keeps its signature. Without a provider, or when a `target` ref is passed, it behaves as before (own listener, no override).

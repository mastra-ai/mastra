---
'@mastra/playground-ui': minor
---

Removed `sessionRef` and `handlers.onMouseEnter` from the `useFluidHover` return value. The highlight no longer restarts when the pointer enters the list, so nothing reads them anymore. Spreading `hover.handlers` onto the list keeps working; only code that reads either field directly needs to drop it.

```tsx
// Before
<div ref={containerRef} onMouseEnter={hover.handlers.onMouseEnter} onMouseMove={hover.handlers.onMouseMove} />
<MyHighlight key={hover.sessionRef.current} rect={rect} />

// After
<div ref={containerRef} onMouseMove={hover.handlers.onMouseMove} />
<MyHighlight rect={rect} />
```

---
'@mastra/playground-ui': patch
---

Fixed the `panelRef` type on `CollapsiblePanel`: it now requires an object ref (for example from `useRef` or `usePanelRef`), since the panel reads `.current` to collapse and expand. Passing a callback ref was accepted by the types but did not work.

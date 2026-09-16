---
'@mastra/react': minor
---

`useStreamWorkflow` now returns `streamResult` as `undefined` until a run is started or observed, instead of an empty object typed as a result. Fixed workflow streams leaking across runs and retaining active readers after reset or unmount.

---
'@mastra/core': patch
---

`setState` is now async

- `setState` must now be awaited: `await setState({ key: value })`
- State updates are merged automatically—no need to spread the previous state
- State data is validated against the step's `stateSchema` when `validateInputs` is enabled (default: `true`)

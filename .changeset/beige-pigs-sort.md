---
'@mastra/core': patch
---

Fixed concurrent runs of the same nested workflow saving each other's input and state. When several parent runs started the same nested workflow at the same time, a nested run's first saved snapshot could hold another run's input and state, so restarting it before its first step finished could continue with another run's data. Each nested run now saves its own input and state.

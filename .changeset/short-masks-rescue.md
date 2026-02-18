---
'@mastra/playground-ui': patch
---

Fixed "Tried to unmount a fiber that is already unmounted" error in the playground agent chat. Switching threads rapidly or creating new threads no longer causes this console error.

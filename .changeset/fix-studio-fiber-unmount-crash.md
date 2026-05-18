---
"mastra": patch
---

Fixed a React component identity bug in Studio that caused "Tried to unmount a fiber that is already unmounted" crashes during long-running agent operations. The assistant message component was being redefined on every render, forcing React to remount the entire message subtree instead of updating it. This was especially visible with agents using high `maxSteps` values.

---
'@internal/playground': patch
---

Fixed the Edit Dataset dialog in Studio staying stuck on screen after clicking Close, Cancel, Save Changes, or pressing Escape. The dialog now animates out and unmounts correctly, and unsaved edits are discarded the next time it opens. Fixes [#17890](https://github.com/mastra-ai/mastra/issues/17890).

---
'@mastra/playground-ui': patch
---

Fixed skills search dialog to correctly identify individual skills. Selection now highlights only the clicked skill, and the Installed badge only shows for the exact skill that was installed (matching by source repository + name). Gracefully handles older server versions without source info by falling back to name-only matching.

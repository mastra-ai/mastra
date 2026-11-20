---
'@mastra/core': patch
---

Fixed restarting a workflow whose nested workflow step had started but whose nested run was never saved. The restart, including recovery on boot, used to fail the whole run with "This workflow run was not active". It now starts the nested workflow with the step's input and the parent's state. State changes made by other parallel steps are kept.

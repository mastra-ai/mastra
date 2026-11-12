---
'mastracode': patch
---

Fixed approval prompts replacing each other when one step asks for several approvals, such as parallel subagent calls. Prompts now appear one at a time and each call starts once you approve it. Dismissing declines every waiting prompt, and "always allow" or YOLO also approves matching waiting calls.

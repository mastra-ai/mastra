---
"@mastra/core": patch
---

Fixed approval cards being silently suppressed when `toolDisplay` is set to `'hidden'` in the static channel driver. The Approve/Deny card is now always rendered regardless of `toolDisplay` or `toolDisplayFn` settings, matching the streaming driver behavior. Previously, using `toolDisplay: 'hidden'` with `requireApproval` would cause the agent run to wait indefinitely with no visible approval buttons.

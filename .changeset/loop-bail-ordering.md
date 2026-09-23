---
'@mastra/core': patch
---

Consume the delegation-bail signal before the `onIterationComplete` hook runs instead of after it. Previously the bail flag was read after the hook and only when the loop was not already stopping, so the hook could receive a wrong `isFinal` in its iteration context while a bail was pending, and when the loop was already stopping the unread flag leaked into the next run of the scope. The bail is now consumed (read and cleared) before the hook, the hook's `isFinal` context reflects the bail, and the flag can no longer leak. The net stop outcome is unchanged: a bail still ends the run.

---
'@internal/playground': patch
---

Fixed reactive signals (like `system-reminder`) disappearing from the Studio chat after reloading the page. The signal was always saved correctly and showed up while the assistant was responding, but the chat stopped displaying persisted reactive signals once the conversation was loaded from history. They now render as a signal badge again on read-back, in both the agent chat and the Agent Builder chat.

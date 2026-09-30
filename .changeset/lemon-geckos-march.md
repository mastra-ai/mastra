---
'@mastra/factory': patch
---

Improved the option pickers in Factory settings (notifications, tool permissions, observe attachments) and the API key sharing choice. They now use one consistent segmented control with a sliding selection. Changing a tool permission now updates instantly instead of briefly disabling the control while it saves. If saving fails, the previous choice is restored and an error is shown.

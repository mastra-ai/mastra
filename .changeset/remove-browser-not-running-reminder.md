---
'@mastra/core': patch
---

Fixed noisy browser reminders being added to non-browser turns. Browser reminders are now added only when browser context exists (for example, current page URL or title).

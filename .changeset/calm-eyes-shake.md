---
'mastra': patch
---

Migrated the studio's theme handling to the shared `ThemeProvider` from `@mastra/playground-ui`. The settings page now uses a System / Light / Dark dropdown and applies the choice immediately. Existing theme preferences are preserved via a one-time migration; the studio continues to default to dark mode for new users.

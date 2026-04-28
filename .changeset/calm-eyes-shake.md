---
'@mastra/playground-ui': patch
'mastra': patch
---

Migrate playground theme handling to the shared `ThemeProvider` from `@mastra/playground-ui`. The settings page now uses a dropdown select for theme selection (System / Light / Dark), while `ThemeToggle` remains available for inline use elsewhere. The legacy local theme provider has been removed. Existing user preferences are preserved automatically via the new storage adapter's one-time migration.

`ThemeToggle` now uses `cursor-pointer` and removes the focus ring flash on click for a cleaner interaction.

The playground continues to default to dark mode for users with no stored preference.

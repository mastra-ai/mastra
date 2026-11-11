---
'@mastra/factory': minor
---

Added Factory-wide sandbox environment variables. Open **Settings › Manage Factory › Environment variables** to add a variable and choose where it applies:

- **Runtime**: every command in every sandbox of the factory. Adds, edits and deletes take effect on the next command in a running sandbox, without restarting it.
- **Build**: the template build and setup commands only. Editing one rebuilds the template on the next build.
- **Both**: runtime and build.

Values are encrypted with the factory's credential encryption key and are never returned by the API or shown again in the UI. When sign-in is on and no key is configured, saving is blocked and the settings page explains why.

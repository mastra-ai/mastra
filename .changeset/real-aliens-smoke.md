---
'@mastra/code-sdk': patch
---

Moved Mastra Code preferences to `~/.mastracode/config.json` and durable app state to application-data `state.json`. The `onboarding`, `modelUseCounts`, and `updateDismissedVersion` fields now live in the state file. Mastra Code migrates existing application-data `settings.json` files and maintains a versioned compatibility mirror for older running versions and downgrades.

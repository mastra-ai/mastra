---
'mastracode': minor
'@mastra/core': patch
---

Added browser automation support via `/browser` command

**New Features:**

- Configure browser automation with `/browser` command (or `/browser on|off|status`)
- Choose between Stagehand (AI-powered) or AgentBrowser (deterministic) providers
- Support for local browsers or Browserbase cloud environments
- Settings persist and can be toggled without reconfiguration

**Usage:**

```
/browser              # Interactive setup wizard
/browser on           # Enable with current settings
/browser off          # Disable browser
/browser status       # Show current configuration
```

When enabled, the agent gains browser tools for web automation tasks.

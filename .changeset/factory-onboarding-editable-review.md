---
'@mastra/factory': patch
---

Redesigned Factory onboarding around an editable draft and a final review. Repository and model choices stay editable until you confirm, survive redirects and reloads, and are only saved when you select **Create factory**. If confirmation fails, retrying reuses the same pending Factory instead of creating a duplicate.

**Model providers**

- API keys and provider sign-in are now separate choices, each with explicit organization or personal scope.
- Provider and model lists offer **Retry** when they fail to load.
- Members without shared organization access choose a personal model, which becomes both the Factory default and their own default.

**Codebase and work**

- Selecting a repository no longer moves you on by itself; **Continue** does.
- Jira and incident.io offer **Reconnect** when a connection needs to be authorized again.

A contextual illustration follows each step and respects reduced-motion settings.

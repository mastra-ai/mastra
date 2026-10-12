---
'@mastra/factory': patch
---

Redesigned Factory onboarding around an editable draft and a final review. Repository and model choices stay editable until you confirm, survive redirects and reloads, and are only saved when you select **Create factory**. If confirmation fails, retrying reuses the same pending Factory instead of creating a duplicate and only replaces the repository link onboarding created. **Create factory** stops with a clear message when the chosen model is no longer available.

**Model providers**

- API keys and provider sign-in are now separate choices, each with explicit organization or personal scope.
- Provider and model lists offer **Retry** when they fail to load.
- Members without shared organization access choose a personal model, which becomes both the Factory default and their own default.

**Codebase and work**

- Selecting a repository no longer moves you on by itself; **Continue** does.
- Jira and incident.io offer **Reconnect** when a connection needs to be authorized again.

A contextual illustration follows each step with smooth transitions and continuous work previews. The artwork and animation are implemented in the app, pause when offscreen, and respect reduced-motion settings.

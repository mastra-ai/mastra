---
'@mastra/factory': patch
---

Redesigned Factory onboarding around an editable draft and a final review. Repository and model choices stay editable until you confirm, survive redirects and reloads, and are only saved when you select **Create factory**. If confirmation fails, retrying reuses the same pending Factory instead of creating a duplicate.

**Model providers**

- API keys and provider sign-in are now separate choices, each with explicit organization or personal scope.
- Device-code sign-in shows the provider's instructions and waits until authorization completes.
- Provider and model lists offer **Retry** when they fail to load.
- Members without shared organization access choose a personal model, which becomes both the Factory default and their own default.

**Codebase and work**

- GitHub and GitLab repositories are picked from one list, with an explicit **Continue**.
- Linear, Jira, and incident.io keep their availability and authorization behavior.

A contextual illustration follows each step and respects reduced-motion settings.

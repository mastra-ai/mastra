---
'@mastra/factory': patch
---

Fixed `factory_switch_session_model` rejecting models that a session can use through stored credentials. Switching to a model like `anthropic/claude-opus-5-5` with a personal Anthropic key used to fail with "Model … is not available on this server". The tool now checks the same credentials as the Settings model picker: the owner's credentials for a user-scoped session, or the Factory's credentials (including custom providers) for a Factory-scoped one. Deployment-only providers still need operator opt-in. Error messages now say whether a model id is unknown or has no credential in the session's scope, and list the models the session can use.

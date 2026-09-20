---
'@mastra/core': patch
---

AgentController sessions now support automatic observational memory model selection per role. `AgentControllerOMConfig.observerModel`/`reflectorModel` and `session.om.<role>.switchModel({ modelId })` accept `'auto'` to follow the active main model; `session.om.<role>.model()` reports the role's configured intent (`'auto' | string | undefined`: a persisted selection, else the configured default) while `modelId()` keeps returning the effective concrete model. Concrete fallback models and persisted explicit overrides are unchanged.

---
"@mastra/core": patch
---

fix(core): skip provider-defined tools when extending schema for auto-resume

Provider-defined tools (e.g., `openai.tools.webSearch()`, `google.tools.googleSearch()`) have a special lazy schema that doesn't work with `standardSchemaToJSONSchema()`. When `autoResumeSuspendedTools` is enabled, CoreToolBuilder tries to extend tool schemas with `suspendedToolRunId` and `resumeData` fields, which was crashing for provider tools.

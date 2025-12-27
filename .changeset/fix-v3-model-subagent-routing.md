---
"@mastra/core": patch
---

Fix AI SDK v6 (specificationVersion: "v3") model support in sub-agent calls. Previously, when a parent agent invoked a sub-agent with a v3 model through the `agents` property, the version check only matched "v2", causing v3 models to incorrectly fall back to legacy streaming methods and throw "V2 models are not supported for streamLegacy" error.

The fix updates version checks in `listAgentTools` and `llm-mapping-step.ts` to use the centralized `supportedLanguageModelSpecifications` array which includes both v2 and v3.

Also adds missing v3 test coverage to tool-handling.test.ts to prevent regression.


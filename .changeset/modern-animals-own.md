---
'@mastra/core': patch
---

Fixed Gemini rejecting tool schemas for agent-as-tools. The `resumeData` field (auto-injected for suspend/resume support) used `z.any()` which produced an invalid JSON Schema with `items: {}` on a non-array type. Gemini requires `items` only when the type is exclusively `ARRAY`. The fallback type union for typeless properties no longer includes `array`, preventing the invalid schema from being sent to the model.

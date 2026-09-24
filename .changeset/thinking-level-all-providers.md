---
'@mastra/code-sdk': patch
---

Forward the session thinking level to native Google and custom OpenAI-compatible providers, plus the direct OpenAI API-key path. Previously the `/think` setting only reached Anthropic and OpenAI Codex; Gemini and custom OpenAI-compatible models silently ignored it.

- Added a generic `createReasoningEffortMiddleware(providerKey, reasoningEffort?)` that injects `providerOptions[providerKey].reasoningEffort` (wire `reasoning_effort`), reusing the existing `THINKING_LEVEL_TO_REASONING_EFFORT` mapping and `getEffectiveThinkingLevel` clamping.
- Wrapped the custom OpenAI-compatible and OpenAI API-key resolution paths with that middleware.
- Added `createGoogleThinkingMiddleware` (in `providers/google-thinking.ts`) that maps the six session levels to Google's supported set and injects `providerOptions.google.thinkingConfig.thinkingLevel`, wired into a native Google branch in `resolveLanguageModel`.

When the thinking level is `off`, no middleware is applied so behavior is unchanged. Anthropic and Codex paths are untouched.

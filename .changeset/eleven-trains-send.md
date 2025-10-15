---
'@mastra/core': patch
---

fix(core): Fix Gemini message ordering validation errors (#7287, #8053)

Fixes Gemini API validation errors by ensuring proper message ordering:
- Issue #7287: Ensures first non-system message is user role (fixes tool-call ordering)
- Issue #8053: Ensures last message is user role (fixes single-turn validation)
- Fixes "contents is not specified" error with empty messages

Resolves compatibility issues with tool-call results, assistant-only messages, and memory truncation scenarios.

---
'@mastra/core': patch
---

fix(core): Fix Gemini message ordering validation errors (#7287, #8053)

Fixes Gemini API "single turn requests" validation error by ensuring the first non-system message is from the user role. This resolves errors when:
- Messages start with assistant role (e.g., from memory truncation)
- Only system messages exist without user input
- Tool-call sequences begin with assistant messages

This fix handles both issue #7287 (tool-call ordering) and #8053 (single-turn validation) by inserting a placeholder user message when needed.

---
'@mastra/core': minor
---

Added PROVIDER_TOOL_CALL observability spans for provider-executed tools (e.g. Anthropic code execution, server-side web search). Provider tool input and output are now visible in traces and Studio, with spans anchored to the AGENT_RUN parent.

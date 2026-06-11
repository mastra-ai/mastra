---
'@mastra/datadog': patch
---

Fixed missing model options and tool calls in Datadog LLM Observability spans.

**Forward model request options** — Model call settings (temperature, maxOutputTokens) and provider-specific options (like OpenAI's reasoningEffort) now reach Datadog. Previously they were stripped before export, so they never appeared on the LLM span. They now show up under the span's metadata, alongside the available tools and tool choice.

**Render tool calls in conversation history** — Tool calls in an LLM's input messages now render correctly in Datadog instead of appearing as empty objects. Previously the raw tool-call shape was passed through unchanged and dropped by Datadog's tracer, losing tool calls from the conversation history. Output tool calls were already handled; input now matches.

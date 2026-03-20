---
'@mastra/core': patch
---

Fixed availableTools not being populated in agent tracing spans for the modern agent loop. Observability integrations like Datadog LLM Observability now correctly receive tool definitions on AGENT_RUN spans when using streaming methods.

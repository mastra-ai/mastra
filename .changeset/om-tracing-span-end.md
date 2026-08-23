---
'@mastra/memory': patch
---

Fixed Observational Memory tracing spans (`om.observer`, `om.observer.multi-thread`, `om.reflector`) never being ended. Unended spans kept their traces retained in exporters that hold a trace open until every span in it finishes — a memory leak with the Datadog bridge, which retains full LLM Observability payloads — and meant Observational Memory tracing never reached any exporter. The spans now end when the observer/reflector run completes, and record the error before ending when it fails.

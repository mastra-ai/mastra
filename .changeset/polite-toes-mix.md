---
'mastra': patch
---

Fixed observability CLI commands (trace, log, score, metric) ignoring `--server-api-prefix` when `--url` is provided. Previously, all `/observability/` routes were unconditionally routed through the hosted observability endpoint, dropping the custom API prefix. Now, when `--url` is explicitly set, observability commands correctly use the provided URL and prefix, matching the behavior of agent, workflow, and thread commands.

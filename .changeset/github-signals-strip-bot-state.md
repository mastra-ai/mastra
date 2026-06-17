---
'@mastra/github-signals': patch
---

Sanitize PR comment bodies at ingestion by stripping all XML/HTML-like markup — HTML comments (including the large base64 machine-state blobs review bots like CodeRabbit hide inside them), tags such as `<details open>`, and any leftover partial markup — and stop persisting the full comment body in notification metadata (the truncated excerpt is retained). This prevents oversized bot payloads from bloating notifications and overflowing agent context windows. The sanitizer is written to avoid catastrophic backtracking (ReDoS) on adversarial input.

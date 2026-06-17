---
'@mastra/github-signals': patch
---

Sanitize PR comment bodies at ingestion by stripping all XML/HTML-like markup — HTML comments (including the large base64 machine-state blobs review bots like CodeRabbit hide inside them), `<details>` sections (delimiters and their collapsed inner content), and any leftover partial markup — and stop persisting the full comment body in notification metadata (the truncated excerpt is retained). Markdown code spans and fenced code blocks are preserved, so human-authored code examples such as `` `<Component>` `` or fenced JSX survive sanitization. This prevents oversized bot payloads from bloating notifications and overflowing agent context windows. The sanitizer uses `indexOf`-based block scanning with no backtracking regex to avoid catastrophic backtracking (ReDoS) on adversarial input.

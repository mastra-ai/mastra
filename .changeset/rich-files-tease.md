---
"@mastra/cloudflare-sandbox": patch
---

Fixed workspace command strings failing as executable names in Cloudflare Sandbox. Commands without separate arguments now run in a non-login shell, preserving the sandbox environment; explicit arguments remain literal.

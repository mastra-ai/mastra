---
'@mastra/core': patch
---

Improved PIIDetector streaming performance by replacing per-chunk LLM calls with local regex-based detection. Streaming PII detection now uses zero-cost regex patterns for common PII types (email, phone, SSN, credit card, IP address, API keys, URLs, UUIDs, crypto wallets, IBAN). Context-dependent PII types (names, addresses, dates of birth) are still caught by the LLM-based detection in processOutputResult on the complete text. This eliminates the N additional API calls per streaming response that caused high costs, latency, and rate-limit issues. Closes #16466

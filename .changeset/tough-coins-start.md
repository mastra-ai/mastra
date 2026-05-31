---
'@mastra/core': patch
---

Improved PIIDetector streaming performance.

- Removed per-chunk LLM calls during streaming PII checks.
- Added local regex detection for common PII types (email, phone, SSN, credit card, IP address, API keys, URLs, UUIDs, crypto wallets, and IBAN).
- Added regex carryover buffer across chunk boundaries to catch split PII patterns.
- Buffered context-dependent PII types (names, addresses, dates of birth) with periodic LLM calls at configurable thresholds.
- Added `bufferSize` option (default: 200) to control LLM buffer flush threshold.
- Reduced streaming API cost, latency, and rate-limit pressure.

Closes #16466.

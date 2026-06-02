---
"@mastra/brightdata": patch
---

Harden Bright Data search input handling. Country and language codes are now validated as alphabetic two-letter codes, the `getBrightDataClient().search.google()` client validates and lowercase-normalizes `language` before the request, and structured JSON (`brd_json=1`) is only requested when the search `format` is `json` so callers can obtain a true raw SERP response.

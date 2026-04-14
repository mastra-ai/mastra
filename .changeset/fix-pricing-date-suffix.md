---
"@mastra/observability": patch
---

Fixed cost lookup for models with date suffixes. Providers like OpenAI often return model names with date suffixes (e.g., `gpt-5.4-mini-2026-03-17`) that don't exactly match pricing data entries. The lookup now tries multiple variants including stripping date suffixes and converting dots to dashes.

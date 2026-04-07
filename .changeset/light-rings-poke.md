---
'@mastra/schema-compat': patch
---

Fixed Google Gemini tool schemas failing when using gateway providers like OpenRouter. The schema compatibility layer now correctly detects Gemini models regardless of the provider, so sub-agent tools work across all supported gateways.

---
'@mastra/langfuse': patch
'@mastra/posthog': patch
---

Fixed token usage reporting for Langfuse and PostHog exporters. The `input` token count now correctly excludes cached tokens, matching each platform's expected format for accurate cost calculation. Cache read and cache write tokens are now properly reported as separate fields (`cache_read_input_tokens`, `cache_creation_input_tokens`) rather than being included in the base input count. Added defensive clamping to ensure input tokens never go negative if cache values exceed the total.

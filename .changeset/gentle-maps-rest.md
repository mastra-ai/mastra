---
'@mastra/observability': patch
---

Fixed cost estimation for OpenRouter models. Token counts rendered in the observability **Model Usage & Cost** panel, but the cost column was empty for any model id reported in OpenRouter's `vendor/model` format (e.g. `openai/gpt-5-mini-2025-08-07`, `xiaomi/mimo-v2-pro-20260318`).

**Why**

OpenRouter routes calls under model ids that contain a `/` separator. The pricing registry's lookup variants previously normalized `.` to `-` and stripped date suffixes, but never handled `/`, so neither stored convention used in OpenRouter pricing data was reachable:

- Some entries flatten the slash and keep the vendor prefix (`xiaomi/mimo-v2-pro` → `xiaomi-mimo-v2-pro`).
- Some entries drop the vendor prefix entirely (`openai/gpt-5-mini` → `gpt-5-mini`).

The registry now also tries the slash-flattened and prefix-dropped variants (with date stripping applied to each), covering both conventions. Native provider lookups (e.g. `openai` / `gpt-4o-mini-2024-07-18`) are unchanged.

Follows up on the previous lookup fixes for dotted names and date suffixes.

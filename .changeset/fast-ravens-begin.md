---
'@mastra/playground-ui': patch
'@mastra/server': patch
---

Fixed custom gateway provider detection in Studio.

**What changed:**

- Studio now correctly detects connected custom gateway providers (e.g., providers registered as `acme/custom` are now found when the agent uses model `acme/custom/gpt-4o`)
- The model selector properly displays and updates models for custom gateway providers
- "Enhance prompt" feature works correctly with custom gateway providers

**Why:**
Custom gateway providers are stored with a gateway prefix (e.g., `acme/custom`), but the model router extracts just the provider part (e.g., `custom`). The lookups were failing because they only did exact matching. Now both backend and frontend use fallback logic to find providers with gateway prefixes.

Fixes #11732

---
'@mastra/core': patch
---

Fixed false positive provider change detection in observational memory. Message metadata now uses the configured model ID instead of the API response model ID, ensuring consistency with step-start parts and preventing incorrect 'Model changed' activations when the provider returns versioned model names (e.g., gpt-5.4-2026-03-05 vs gpt-5.4).

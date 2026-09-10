---
'@mastra/core': patch
---

Fixed unsupported sampling parameters (temperature, topP, topK) being sent to models that reject them. Previously these were only stripped for model-router IDs, so models passed as provider instances (e.g. from @ai-sdk/anthropic or @ai-sdk/amazon-bedrock) and every aws-bedrock/* model still sent them and failed with a 400. Stripping now happens on the shared model-call path, and Bedrock-hosted models resolve their capabilities from the underlying vendor (with an explicit override for grok-4.6, which rejects temperature on Bedrock even though direct xAI accepts it). Fixes #23319.

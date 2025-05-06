---
'@mastra/core': patch
---

Adds a tool compatibility layer to ensure models from various providers work the same way. Models may not be able to support all json schema properties (such as some openai reasoning models), as well as other models support the property but seem to ignore it. The feature allows for a compatibility class for a provider that can be customized to fit the models and make sure they're using the tool schemas properly.

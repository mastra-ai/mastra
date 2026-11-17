---
'@mastra/factory': patch
---

The provider and model settings no longer fail when the Mastra Gateway model catalogue cannot be fetched. The Gateway row stays in the provider list so it can still be connected or disconnected. An organization that connected its own v2 Gateway key now sees the models that key can use instead of the bundled list.

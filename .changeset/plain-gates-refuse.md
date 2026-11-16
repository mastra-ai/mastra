---
'@mastra/factory': patch
---

Factory now explains Mastra Gateway v2 refusals correctly in the web UI and in Slack. An organization budget, a key or organization spend limit, an unsupported billing plan, a routing policy refusal, a context that is too large and the gateway's own rate limit each get their own message, and "Add credits" is offered only where adding credits helps. A gateway at the configured base URL, such as staging or a self-hosted one, is recognized too.

The provider and model settings no longer fail when the Mastra Gateway model catalogue cannot be fetched. The Gateway row stays in the provider list so it can still be connected or disconnected. An organization that connected its own v2 Gateway key now sees the models that key can use instead of the bundled list.

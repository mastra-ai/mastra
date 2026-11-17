---
'@mastra/factory': patch
---

Factory now explains Mastra Gateway v2 refusals correctly in the web UI and in Slack. An organization budget, a key or organization spend limit, an unsupported billing plan, a routing policy refusal and a context that is too large each get their own message, and "Add credits" is offered only where adding credits helps. Slack error cards also name the gateway's own rate limit, and recognize a gateway at the configured base URL, such as staging or a self-hosted one. The web UI recognizes v2 refusals from any gateway by their response body.

The provider and model settings no longer fail when the Mastra Gateway model catalogue cannot be fetched. The Gateway row stays in the provider list so it can still be connected or disconnected. An organization that connected its own v2 Gateway key now sees the models that key can use instead of the bundled list.

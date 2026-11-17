---
'@mastra/factory': patch
---

Factory now explains Mastra Gateway v2 refusals correctly in the web UI and in Slack. An organization budget, a key or organization spend limit, an unsupported billing plan, a routing policy refusal and a context that is too large each get their own message, and "Add credits" is offered only where adding credits helps. A rate limit now says whether the gateway's own limit on the key or organization was reached or the model provider behind the gateway is limiting requests, and no longer suggests changing credentials. A gateway at the configured base URL, such as staging or a self-hosted one, is recognized as well as the production one. The web UI recognizes v2 refusals from any gateway by their response body. In the web UI, rate limits and errors without a gateway reply body are recognized only for runs saved by a version of `@mastra/core` that records the request origin; older saved errors keep the generic provider message.

The provider and model settings no longer fail when the Mastra Gateway model catalogue cannot be fetched. The Gateway row stays in the provider list so it can still be connected or disconnected. An organization that connected its own v2 Gateway key now sees the models that key can use instead of the bundled list.

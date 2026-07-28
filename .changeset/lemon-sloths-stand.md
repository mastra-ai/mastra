---
'@mastra/factory': patch
---

Added a `channel-identity` storage domain so a factory can link a chat-platform sender to one of its own users.

`ChannelIdentityStorage` persists account links keyed by platform, external team id, and external user id, and records an optional default factory project per link. Alongside it, `createChannelLinkStateSigner` signs and verifies the short-lived state passed through an account-linking redirect, so a connect flow can round-trip through an external identity provider without trusting the returned parameters.

Both are exported from the package entry point, together with the existing projects and work-items storage domains and `createFactoryRouteAuth`, which previously had no public export.

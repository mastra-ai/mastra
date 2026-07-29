---
'@mastra/factory': minor
---

Added a `channel-identity` storage domain so a factory can link a chat-platform sender to one of its own users, and a `channels()` slot so an integration can supply the chat platform itself.

`ChannelIdentityStorage` persists account links keyed by platform, external team id, and external user id, and records an optional default factory project per link. A link is written only after the chat platform itself asserts the account through OpenID Connect, with the existing `createStateSigner` binding the round trip to the tenant that started it.

`FactoryIntegration` gains an optional `channels(ctx)` returning an `AgentControllerChannels`, which the factory attaches to the mounted agent controller during `prepare()`. Inbound platform messages then reach the same agents the web UI drives, without the deploy entry reaching into the prepared controller to wire them by hand. `IntegrationContext` gains `storage.channelIdentity` for integrations that use the slot. Providing `channels()` adds the `channel-identity` domain to the integration's readiness requirements, so an integration whose reverse index is not migrated reports not-ready and its channels never attach. Only one integration may provide channels; a second fails the boot, because attaching replaces rather than merges.

The integration seam itself — `FactoryIntegration`, `IntegrationContext`, `IntegrationHooks`, and `IntegrationTools` — is now exported from the package entry point. Implementing an integration outside this package was already the documented path for third parties, but the types to do it were unreachable. `ChannelIdentityStorage` and `createFactoryRouteAuth` are exported too, alongside the existing projects and work-items storage domains.

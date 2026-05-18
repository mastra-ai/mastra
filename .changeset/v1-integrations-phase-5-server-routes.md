---
'@mastra/server': minor
'@mastra/client-js': minor
---

Add HTTP surface for `ToolIntegration` providers under
`/api/tool-integrations/*`. Seven new routes cover the catalog
(`list integrations`, `list tool-services`, `list tools`), the OAuth
surface (`authorize`, `auth-status`, `connection-status`) and an
integration-level `health` check. All routes route through
`editor.getToolIntegrationOrThrow`, mapping `UnknownIntegrationError` to
HTTP 404.

The `@mastra/client-js` SDK gains `client.listToolIntegrations()` and
`client.getToolIntegration(id)`, which returns a `ToolIntegration`
resource exposing typed wrappers for each route. Legacy
`/api/tool-providers/*` routes and the `client.getToolProvider(id)`
accessor are unchanged and continue to ride the v1 compatibility
window.

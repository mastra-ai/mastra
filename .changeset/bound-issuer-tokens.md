---
'@mastra/mcp': patch
---

Bind `MCPOAuthClientProvider` credentials to the authorization server: tokens are persisted per validated `issuer`, discovery state is stored so the code exchange only goes to the server that issued the redirect, and storage mutations are serialized so a write cannot land after `invalidateCredentials('all')`. `createOAuthCallbackServer` captures the RFC 9207 `iss` parameter and `MCPClient.authenticate()` forwards it so an issuer mismatch is rejected before the authorization code is exchanged. A Client ID Metadata Document configuration must mirror the hosted document (`client_id`, `client_name`, `redirect_uris`), and OAuth metadata redirects are checked against `allowedHosts` before being followed.

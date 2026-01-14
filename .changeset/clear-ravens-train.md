---
'@mastra/mcp': minor
---

Add OAuth 2.1 support for MCP client and server

Client-side OAuth:
- MCPOAuthClientProvider: Ready-to-use OAuth provider implementation for connecting to - OAuth-protected MCP servers
- Supports dynamic client registration (RFC 7591), PKCE, and token refresh
- OAuthStorage interface with InMemoryOAuthStorage for token persistence
- createSimpleTokenProvider helper for testing with pre-configured tokens

Server-side OAuth middleware:
- createOAuthMiddleware - Middleware for protecting MCP server endpoints with OAuth
Serves Protected Resource Metadata at /.well-known/oauth-protected-resource (RFC 9728)
- createStaticTokenValidator for simple token validation in development
- createIntrospectionValidator for production token introspection (RFC 7662)

Shared utilities:
- Re-exports OAuth types from the MCP SDK
- MCPServerOAuthConfig and TokenValidationResult types
- Helper functions for WWW-Authenticate headers and Protected Resource Metadata generation

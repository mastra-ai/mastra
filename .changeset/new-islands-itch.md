---
'@mastra/core': minor
---

Added Memory Gateway support

- `GATEWAY_AUTH_HEADER` — exported constant for the custom gateway authentication header (`X-Memory-Gateway-Authorization`)
- `MastraGatewayConfig` — new type for configuring gateway instances with `apiKey`, `baseUrl`, and `customFetch`

When a custom fetch function is provided, the gateway uses `X-Memory-Gateway-Authorization` for gateway auth, allowing OAuth tokens to be passed via the standard `Authorization` header.

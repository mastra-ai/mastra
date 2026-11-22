---
'@mastra/factory': minor
---

Platform integrations now talk to the Mastra platform through `ConnectClient` from `@mastra/connect`, so every integration shares one client.

**Breaking:** the `clientConfig` constructor option on Platform integrations is replaced by `connect`, which takes a `ConnectClient` or its options. `PlatformApiClient` and `PlatformApiError` are removed; platform errors are now `MastraConnectError`, with `retryAfterMs` instead of `retryAfterSeconds`.

```ts
// Before
new PlatformJiraIntegration({
  clientConfig: { baseUrl, accessToken, fetchImpl },
});

// After
new PlatformJiraIntegration({
  connect: { baseUrl, accessToken, fetch: fetchImpl },
});
```

Leaving the option unset still reads the platform environment (`MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_INTEGRATIONS_API_URL`, `MASTRA_PLATFORM_REGION`, `MASTRA_PROJECT_ID`), as before.

---
'@mastra/server': patch
---

Added HTTP request logging infrastructure. This enables `apiReqLogs: true` (or a detailed `HttpLoggingConfig`) in the server config to log method, path, status, and duration for every request, with optional header redaction and path exclusions.

**Simple activation**

```ts
const mastra = new Mastra({
  server: { build: { apiReqLogs: true } },
});
```

**Advanced configuration**

```ts
const mastra = new Mastra({
  server: {
    build: {
      apiReqLogs: {
        enabled: true,
        level: 'info',
        excludePaths: ['/health', '/ready'],
        includeHeaders: true,
        includeQueryParams: true,
        redactHeaders: ['authorization', 'cookie'],
      },
    },
  },
});
```

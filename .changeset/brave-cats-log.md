---
'@mastra/server': patch
'@mastra/hono': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/koa': patch
---

Added HTTP request logging middleware to all server adapters.

Enable with `apiReqLogs: true` for default settings, or pass a configuration object for fine-grained control:

```typescript
const mastra = new Mastra({
  server: {
    build: {
      // Simple: logs method, path, status, duration at 'info' level
      apiReqLogs: true,

      // Advanced configuration
      apiReqLogs: {
        enabled: true,
        level: 'debug',
        excludePaths: ['/health', '/ready'],
        includeQueryParams: true,
        includeHeaders: true,
        redactHeaders: ['authorization', 'cookie', 'x-api-key'],
      },
    },
  },
});
```

Logs include method, path, status code, and request duration. Sensitive headers are redacted by default.

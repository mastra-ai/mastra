---
'@mastra/express': patch
'@mastra/hono': patch
'@mastra/fastify': patch
'@mastra/koa': patch
---

Added HTTP request logging middleware. Enable with `apiReqLogs: true` for default settings, or pass a configuration object for fine-grained control.

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
        level: 'debug',
        excludePaths: ['/health'],
        includeHeaders: true,
        includeQueryParams: true,
        redactHeaders: ['authorization', 'cookie'],
      },
    },
  },
});
```

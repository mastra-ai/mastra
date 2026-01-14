---
'@mastra/express': patch
'@mastra/hono': patch
'@mastra/server': patch
'@mastra/core': patch
---

feat(server): add configurable HTTP request logging middleware

Server adapters (`@mastra/hono`, `@mastra/express`) now support built-in HTTP request logging. The existing `apiReqLogs` configuration flag has been enhanced to support both simple boolean activation and detailed configuration options.

**What's new:**

**1. Simple activation** - Enable HTTP request logging with default settings:

```typescript
const mastra = new Mastra({
  server: {
    build: {
      apiReqLogs: true, // Logs method, path, status, duration at 'info' level
    },
  },
});
```

**2. Advanced configuration** - Customize logging behavior with detailed options:

```typescript
const mastra = new Mastra({
  server: {
    build: {
      apiReqLogs: {
        enabled: true,
        level: 'debug', // 'debug' | 'info' | 'warn'
        excludePaths: ['/health', '/ready', '/metrics'],
        includeQueryParams: true,
        includeHeaders: true,
        redactHeaders: ['authorization', 'cookie', 'x-api-key'],
      },
    },
  },
});
```

**Configuration options:**
- `enabled` - Enable/disable HTTP request logging
- `level` - Log level: 'debug', 'info', or 'warn' (default: 'info')
- `excludePaths` - Array of paths to exclude from logging (e.g., health check endpoints)
- `includeHeaders` - Include request headers in log output (default: false)
- `includeQueryParams` - Include query parameters in log output (default: false)
- `redactHeaders` - Headers to redact from logs when `includeHeaders` is true (default: ['authorization', 'cookie'])

Logging integrates with the existing Mastra logger and outputs structured log data including method, path, status code, and request duration. Sensitive headers are redacted by default to prevent accidental credential exposure.

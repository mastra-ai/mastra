# HTTP Request Logging for Server Adapters

## Problem

Mastra server adapters (`@mastra/hono`, `@mastra/express`) currently don't have HTTP request logging. This makes it difficult to:

- Debug request/response issues
- Monitor API usage
- Track response times
- Identify slow endpoints

## Current State

- Server adapters have `console.error` for errors only
- Adapters have access to `this.logger` (inherited from `MastraServerBase`)
- No middleware logs incoming requests, response times, or status codes

## Proposed Solution

Add optional HTTP request logging middleware that uses the Mastra logger.

### Option 1: Built-in Middleware

Add a `registerHttpLoggingMiddleware()` method to `MastraServerBase`:

```typescript
// In MastraServerBase
abstract registerHttpLoggingMiddleware(): void;

// In @mastra/hono
registerHttpLoggingMiddleware(): void {
  this.app.use('*', async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;

    this.logger?.info({
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration,
    });
  });
}

// In @mastra/express
registerHttpLoggingMiddleware(): void {
  this.app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      this.logger?.info({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
      });
    });
    next();
  });
}
```

### Option 2: Configuration-based

Add logging options to server config:

```typescript
const mastra = new Mastra({
  server: {
    httpLogging: {
      enabled: true,
      level: "info", // 'debug' | 'info' | 'warn'
      includeHeaders: false,
      includeBody: false,
      excludePaths: ["/health", "/ready"],
    },
  },
});
```

### Option 3: Let Users Add Their Own

Document how users can add their own logging middleware:

```typescript
// Hono
import { logger } from "hono/logger";
app.use("*", logger());

// Express
import morgan from "morgan";
app.use(morgan("combined"));
```

## Considerations

1. **Performance**: Logging adds overhead. Should be optional.
2. **Sensitive Data**: Don't log auth headers, request bodies with PII, etc.
3. **Log Format**: Should integrate with Mastra's existing logger format.
4. **Filtering**: Users may want to exclude certain paths (health checks).

## Recommendation

Start with **Option 3** (documentation) since:

- Users already have flexibility with Hono/Express middleware
- No additional code to maintain
- Users can choose their preferred logging library

If there's demand, consider **Option 2** for a more integrated experience.

## Related

- Issue: TBD
- PR: TBD

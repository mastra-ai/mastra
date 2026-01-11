---
'@mastra/libsql': minor
'@mastra/opensearch': minor
'@mastra/pinecone': minor
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/cloudflare-d1': patch
'@mastra/lance': patch
'@mastra/mongodb': patch
'@mastra/pg': patch
'@mastra/upstash': patch
'@mastra/deployer-cloud': patch
'@mastra/memory': patch
'@mastra/codemod': patch
'@mastra/dynamodb': patch
---

Aligned vector store configuration with underlying library APIs, giving you access to all library options directly.

**Why this change?**

Previously, each vector store defined its own configuration types that only exposed a subset of the underlying library's options. This meant users couldn't access advanced features like authentication, SSL, compression, or custom headers without creating their own client instances. Now, the configuration types extend the library types directly, so all options are available.

**@mastra/libsql** (Breaking)

Renamed `connectionUrl` to `url` to match the `@libsql/client` API and align with LibSQLStorage.

```typescript
// Before
new LibSQLVector({ id: 'my-vector', connectionUrl: 'file:./db.sqlite' })

// After
new LibSQLVector({ id: 'my-vector', url: 'file:./db.sqlite' })
```

**@mastra/opensearch** (Breaking)

Renamed `url` to `node` and added support for all OpenSearch `ClientOptions` including authentication, SSL, and compression.

```typescript
// Before
new OpenSearchVector({ id: 'my-vector', url: 'http://localhost:9200' })

// After
new OpenSearchVector({ id: 'my-vector', node: 'http://localhost:9200' })

// With authentication (now possible)
new OpenSearchVector({
  id: 'my-vector',
  node: 'https://localhost:9200',
  auth: { username: 'admin', password: 'admin' },
  ssl: { rejectUnauthorized: false },
})
```

**@mastra/pinecone** (Breaking)

Removed `environment` parameter. Use `controllerHostUrl` instead (the actual Pinecone SDK field name). Added support for all `PineconeConfiguration` options.

```typescript
// Before
new PineconeVector({ id: 'my-vector', apiKey: '...', environment: '...' })

// After
new PineconeVector({ id: 'my-vector', apiKey: '...' })

// With custom controller host (if needed)
new PineconeVector({ id: 'my-vector', apiKey: '...', controllerHostUrl: '...' })
```

**@mastra/clickhouse**

Added support for all `ClickHouseClientConfigOptions` like `request_timeout`, `compression`, `keep_alive`, and `database`. Existing configurations continue to work unchanged.

**@mastra/cloudflare, @mastra/cloudflare-d1, @mastra/lance, @mastra/libsql, @mastra/mongodb, @mastra/pg, @mastra/upstash**

Improved logging by replacing `console.warn` with structured logger in workflow storage domains.

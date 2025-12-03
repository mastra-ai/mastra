# Traces API Query Parameters Design

## Overview

This document describes the query parameter format for the `GET /api/observability/traces` endpoint.

## Design Goals

1. **Human-readable URLs** - Simple params as plain scalars, no unnecessary nesting
2. **Bidirectional serialization** - `qs` library handles stringify and parse
3. **Bracket notation only when needed** - For genuinely nested structures (dateRange, arrays, maps)
4. **No JSON in query params** - Avoid URL-encoded JSON blobs

## Query Parameter Format

Flattened approach:

- **Simple scalars**: At root level (page, perPage, entityType, status, etc.)
- **Nested objects**: Bracket notation (dateRange, metadata, tags)

### Pagination

```
?page=0&perPage=20
```

### Simple String Filters

All simple string filters are at root level:

```
?entityType=agent
&entityId=weatherAgent
&entityName=Weather%20Agent
&userId=user_123
&organizationId=org_456
&resourceId=res_789
&runId=run_abc
&sessionId=sess_def
&threadId=thread_ghi
&requestId=req_jkl
&environment=production
&source=cloud
&serviceName=api-server
&deploymentId=deploy_123
&status=success
&spanType=AGENT_EXECUTOR_RUN
```

### Boolean Filters

```
?hasChildError=true
```

### Date Range (nested)

Uses bracket notation since it has nested start/end:

```
?dateRange[start]=2024-01-01T00:00:00.000Z
&dateRange[end]=2024-12-31T23:59:59.999Z
```

Either `start` or `end` can be omitted for open-ended ranges.

### Array Filters - tags (nested)

Uses bracket notation with indices:

```
?tags[0]=production
&tags[1]=v2
&tags[2]=critical
```

Parsed as: `{ tags: ["production", "v2", "critical"] }`

### Key-Value Filters - metadata, scope, versionInfo (nested)

Uses bracket notation for dynamic keys:

```
?metadata[customerId]=abc123
&metadata[region]=us-east
&metadata[priority]=high
```

Parsed as: `{ metadata: { customerId: "abc123", region: "us-east", priority: "high" } }`

Same pattern for `scope` and `versionInfo`:

```
?scope[core]=1.0.0
&versionInfo[app]=2.0.0
&versionInfo[gitSha]=abc123
```

## Complete Example

```
GET /api/observability/traces?page=0&perPage=20&entityType=agent&entityId=weatherAgent&status=success&dateRange[start]=2024-01-01T00:00:00.000Z&tags[0]=production&tags[1]=v2&metadata[customerId]=abc123
```

## Parameter Summary

| Parameter       | Type    | Format  | Example                                   |
| --------------- | ------- | ------- | ----------------------------------------- |
| `page`          | number  | scalar  | `page=0`                                  |
| `perPage`       | number  | scalar  | `perPage=20`                              |
| `entityType`    | string  | scalar  | `entityType=agent`                        |
| `entityId`      | string  | scalar  | `entityId=weatherAgent`                   |
| `spanType`      | string  | scalar  | `spanType=AGENT_EXECUTOR_RUN`             |
| `status`        | string  | scalar  | `status=success`                          |
| `userId`        | string  | scalar  | `userId=user_123`                         |
| `hasChildError` | boolean | scalar  | `hasChildError=true`                      |
| `dateRange`     | object  | bracket | `dateRange[start]=...&dateRange[end]=...` |
| `tags`          | array   | bracket | `tags[0]=a&tags[1]=b`                     |
| `metadata`      | object  | bracket | `metadata[key]=value`                     |
| `scope`         | object  | bracket | `scope[key]=value`                        |
| `versionInfo`   | object  | bracket | `versionInfo[key]=value`                  |

## Implementation

### Using the `qs` Library

Both client and server use the `qs` library for consistent handling of nested structures.

### Server-Side Parsing

The server uses `parseTracesQueryParams()` from `@mastra/core/storage`:

1. **Parse with qs** - Convert bracket notation to nested objects
2. **Restructure** - Move scalar params into `filters` object, pagination into `pagination`
3. **Validate with Zod** - Coerce types (strings → numbers, dates, booleans)

```typescript
export function parseTracesQueryParams(input: string | Record<string, string>): ParseResult {
  // Parse with qs (handles bracket notation for nested objects)
  const parsed = qs.parse(queryString, { ignoreQueryPrefix: true, depth: 2 });

  // Restructure: scalar filters at root → filters object
  // page/perPage → pagination object
  const restructured = {
    pagination: { page: parsed.page, perPage: parsed.perPage },
    filters: {
      entityType: parsed.entityType,
      entityId: parsed.entityId,
      // ... other scalar filters
      dateRange: parsed.dateRange, // already nested from qs
      tags: parsed.tags, // already array from qs
      metadata: parsed.metadata, // already nested from qs
    },
  };

  // Validate with Zod (handles type coercion)
  return tracesPaginatedArgSchema.safeParse(restructured);
}
```

### Client-Side Serialization

The client uses `serializeTracesParams()` from `@mastra/core/storage`:

```typescript
export function serializeTracesParams(args: TracesPaginatedArg): string {
  // Flatten: pagination and scalar filters to root level
  // Keep nested: dateRange, tags, metadata, scope, versionInfo
  const flattened = {
    page: args.pagination?.page,
    perPage: args.pagination?.perPage,
    entityType: args.filters?.entityType,
    entityId: args.filters?.entityId,
    // ... other scalar filters
    dateRange: args.filters?.dateRange, // stays nested
    tags: args.filters?.tags, // stays nested
    metadata: args.filters?.metadata, // stays nested
  };

  return qs.stringify(flattened, {
    encode: true,
    skipNulls: true,
    arrayFormat: 'indices', // tags[0]=a&tags[1]=b
  });
}
```

### Schema

The source of truth is `tracesPaginatedArgSchema` in `@mastra/core/storage/schemas/observability`.
Uses `z.coerce` for automatic string → type conversion from query params.

## Error Handling

### 400 Bad Request Response

If validation errors occur, return all errors:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "pagination.page",
      "message": "Expected number, received 'abc'"
    },
    {
      "field": "filters.dateRange.start",
      "message": "Invalid datetime format"
    }
  ]
}
```

## Migration from Dot Notation

This replaces the previous dot notation format:

| Old Format            | New Format                       |
| --------------------- | -------------------------------- |
| `page=0`              | `page=0` (unchanged)             |
| `perPage=20`          | `perPage=20` (unchanged)         |
| `entityType=agent`    | `entityType=agent` (unchanged)   |
| `entityId=abc`        | `entityId=abc` (unchanged)       |
| `status=success`      | `status=success` (unchanged)     |
| `hasChildError=true`  | `hasChildError=true` (unchanged) |
| `dateRange.start=...` | `dateRange[start]=...`           |
| `tags=a,b`            | `tags[0]=a&tags[1]=b`            |
| `metadata.key=val`    | `metadata[key]=val`              |

The qs library handles bracket notation for nested structures.
Simple scalars remain at root level for maximum readability.

# Traces API Query Parameters Design

## Overview

This document describes the query parameter format for the `GET /api/observability/traces` endpoint.

## Design Goals

1. **Human-readable URLs** - Easy to construct, debug, and share
2. **Standard conventions** - Follow established patterns used by major APIs
3. **No JSON in query params** - Avoid URL-encoded JSON blobs
4. **Simple parsing** - No complex codecs, just standard transforms

## Query Parameter Format

### Simple String Filters

Pass directly as query params:

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

### Pagination

Numbers are coerced from strings:

```
?page=0
&perPage=20
```

### Boolean Filters

Use string `true` or `false`:

```
?hasChildError=true
```

### Date Range

Use dot notation with ISO 8601 datetime strings:

```
?dateRange.start=2024-01-01T00:00:00.000Z
&dateRange.end=2024-12-31T23:59:59.999Z
```

Either `start` or `end` can be omitted for open-ended ranges.

### Array Filters (tags)

Use comma-separated values:

```
?tags=production,v2,critical
```

Parsed as: `["production", "v2", "critical"]`

### Nested Object Filters (metadata, scope, versionInfo)

Use dot notation for key-value pairs:

```
?metadata.customerId=abc123
&metadata.region=us-east
&metadata.priority=high
```

Parsed as: `{ customerId: "abc123", region: "us-east", priority: "high" }`

Same pattern for `scope` and `versionInfo`:

```
?scope.core=1.0.0
&scope.memory=1.0.0
&versionInfo.app=2.0.0
&versionInfo.gitSha=abc123
```

## Complete Example

```
GET /api/observability/traces?page=0&perPage=20&dateRange.start=2024-01-01T00:00:00.000Z&entityType=agent&entityId=weatherAgent&status=success&tags=production,v2&metadata.customerId=abc123&metadata.region=us-east
```

## Implementation

### Server-Side Parsing

The server uses `parseTracesQueryParams()` from `@mastra/core/storage`:

1. **Transform raw params** into the structure expected by `tracesPaginatedArgSchema`:
   - Split comma-separated tags: `tags=a,b` → `{ filters: { tags: ["a", "b"] } }`
   - Group dot-notation params: `metadata.key=val` → `{ filters: { metadata: { key: "val" } } }`
   - Coerce types: strings → numbers, dates, booleans
2. **Validate with Zod** using the existing `tracesPaginatedArgSchema`
3. **Return all errors** if validation fails (Zod collects all issues)

### Client-Side Serialization

The client uses `serializeTracesParams()` from `@mastra/core/storage`:

1. **Flatten nested objects** - `{ filters: { metadata: { key: "val" } } }` → `metadata.key=val`
2. **Join arrays** - `{ filters: { tags: ["a", "b"] } }` → `tags=a,b`
3. **Convert types to strings** - Dates to ISO strings, booleans to `"true"`/`"false"`

### Schema

The source of truth is `tracesPaginatedArgSchema` in `@mastra/core/storage/schemas/observability`:

```typescript
// Core schemas - single source of truth
export const tracesFilterSchema = z.object({
  dateRange: dateRangeSchema.optional(),
  spanType: spanTypeSchema.optional(),
  entityType: spanEntityTypeSchema.optional(),
  entityId: z.string().optional(),
  // ... all other filter fields with proper types
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  hasChildError: z.boolean().optional(),
});

export const tracesPaginatedArgSchema = z.object({
  filters: tracesFilterSchema.optional(),
  pagination: paginationArgsSchema.optional(),
});
```

## Error Handling

### Validation Error Collection

When parsing query parameters, **collect all validation errors** before returning a response. Do not fail on the first error - gather all issues so the client can fix them in one iteration.

### 400 Bad Request Response

If any validation errors occur, return a `400 Bad Request` with all errors combined:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "page",
      "message": "Expected number, received 'abc'"
    },
    {
      "field": "dateRange.start",
      "message": "Invalid datetime format"
    },
    {
      "field": "status",
      "message": "Invalid enum value. Expected 'success' | 'error' | 'running', received 'pending'"
    }
  ]
}
```

### Implementation

Use Zod's built-in error collection - it automatically gathers all validation issues:

```typescript
const result = tracesQuerySchema.safeParse(preprocessedParams);

if (!result.success) {
  const details = result.error.issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));

  throw new HTTPException(400, {
    message: 'Validation failed',
    details,
  });
}

// Proceed with query using result.data
return storage.getTracesPaginated(result.data);
```

### Success Response

On successful validation, execute the query and return paginated results:

```json
{
  "spans": [...],
  "pagination": {
    "page": 0,
    "perPage": 20,
    "total": 150,
    "hasMore": true
  }
}
```

## Migration

### Changes Completed

1. **Reverted zod4 dependency** - Using zod v3 only
2. **Added `parseTracesQueryParams()`** - Transforms raw query params and validates with Zod
3. **Added `serializeTracesParams()`** - Serializes `TracesPaginatedArg` to `URLSearchParams`
4. **Updated server handler** - Uses `parseTracesQueryParams()` with proper error handling
5. **JS client** - Should use `serializeTracesParams()` for building query strings

### Backward Compatibility

This is a breaking change for the query param format. The previous format used:

- `tags=tag1,tag2` (comma-separated)
- `metadata={"key":"value"}` (JSON string)
- `dateRange={"start":"...","end":"..."}` (JSON string)

Clients will need to update to the new format.

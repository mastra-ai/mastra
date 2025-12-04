# Query String Handling Patterns

This document describes how query parameters are handled across the Mastra API.

## Overview

- **Observability API** - Uses `qs` library with bracket notation for nested objects/arrays
- **Memory API** - Uses `z.preprocess` with JSON.parse for complex objects
- **Other endpoints** - Simple scalars with native `URLSearchParams`

## Server-Side Patterns

### Simple Scalars

Use Zod's `z.coerce` for automatic string-to-type conversion:

```typescript
// packages/server/src/server/schemas/common.ts
export const createPagePaginationSchema = (defaultPerPage?: number) => {
  return z.object({
    page: z.coerce.number().optional().default(0),
    perPage: z.coerce.number().optional().default(defaultPerPage),
  });
};
```

Works for:

- Numbers: `z.coerce.number()` - `"42"` → `42`
- Dates: `z.coerce.date()` - `"2024-01-01T00:00:00Z"` → `Date`
- Strings: `z.string()` - passed through as-is
- Enums: `z.enum([...])` - validated against allowed values

### Complex Objects (JSON Strings)

Use `z.preprocess` to JSON.parse string values:

```typescript
// packages/server/src/server/schemas/memory.ts
const filterSchema = z.preprocess(
  val => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return undefined;
      }
    }
    return val;
  },
  z
    .object({
      dateRange: z
        .object({
          start: z.coerce.date().optional(),
          end: z.coerce.date().optional(),
        })
        .optional(),
    })
    .optional(),
);
```

Used by memory endpoints for: `filter`, `include`, `orderBy`, `memoryConfig`

## Client-Side Patterns

### Building Query Strings

```typescript
// packages/client-sdks/client-js/src/resources/memory-thread.ts
const queryParams: Record<string, string> = {};

// Simple values - just convert to string
if (page !== undefined) queryParams.page = String(page);
if (perPage !== undefined) queryParams.perPage = String(perPage);
if (resourceId) queryParams.resourceId = resourceId;

// Complex objects - JSON.stringify
if (orderBy) queryParams.orderBy = JSON.stringify(orderBy);
if (filter) queryParams.filter = JSON.stringify(filter);
if (include) queryParams.include = JSON.stringify(include);

const query = new URLSearchParams(queryParams);
const url = `/api/endpoint?${query.toString()}`;
```

## Endpoint Patterns by Type

| Endpoint          | Complex Params                                        | Approach                                                     |
| ----------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| **Workflows**     | None                                                  | Simple scalars only (`page`, `offset`, `fromDate`, `status`) |
| **Logs**          | None                                                  | Simple scalars, `filters` as string/string[]                 |
| **Scores**        | None                                                  | Simple scalars only                                          |
| **Memory**        | `filter`, `include`, `orderBy`                        | JSON strings with `z.preprocess`                             |
| **Observability** | `startedAt`, `endedAt`, `orderBy`, `metadata`, `tags` | qs bracket notation (recommended)                            |

## URL Examples

### Simple Scalars (Most Endpoints)

```
GET /api/workflows/runs?offset=0&limit=20&fromDate=2024-01-01T00:00:00Z&status=success
```

### JSON Strings (Memory)

```
GET /api/memory/threads/thread-123/messages?agentId=myAgent&page=0&perPage=40&filter={"dateRange":{"start":"2024-01-01T00:00:00Z"}}&orderBy={"field":"createdAt","direction":"DESC"}
```

### Bracket Notation (Observability)

```
GET /api/observability/traces?page=0&perPage=20&entityType=agent&startedAt[start]=2024-01-01T00:00:00Z&orderBy[field]=startedAt&orderBy[direction]=DESC&tags[0]=prod&tags[1]=v2&metadata[customerId]=abc123
```

## Trade-offs

### JSON Strings

- **Pros**: Simple to implement, reuses standard JSON
- **Cons**: URLs are ugly when encoded (`%7B%22dateRange%22%3A...`), harder to debug

### Bracket Notation (qs library)

- **Pros**: Human-readable URLs, standardized via qs library, easy bidirectional serialization
- **Cons**: Slightly more verbose than dot notation for deeply nested structures

### Simple Scalars Only

- **Pros**: Cleanest URLs, no special handling needed
- **Cons**: Can't represent nested structures

## Recommendations

1. **For new endpoints with nested params**: Use `qs` library with bracket notation (like Observability API)
2. **For simple endpoints**: Use native `URLSearchParams` with simple scalars
3. **Avoid JSON strings in query params**: They're hard to read and debug
4. **Consider POST**: For very complex queries, a POST with JSON body may be cleaner

## The `qs` Pattern (Recommended for Complex Params)

The Observability API uses `qs` for bidirectional query string handling with a flattened approach:

- **Simple scalars at root**: `page`, `perPage`, `entityType`, `entityId`, `status`, etc.
- **Bracket notation only for nested**: `startedAt[start]`, `endedAt[end]`, `orderBy[field]`, `tags[0]`, `metadata[key]`

```typescript
import qs from 'qs';

// Client: serialize with everything flattened except nested structures
const queryString = qs.stringify(
  {
    page: 0,
    perPage: 20,
    entityType: 'agent',
    entityId: 'weatherAgent',
    status: 'success',
    startedAt: { start: '2024-01-01T00:00:00Z' },
    orderBy: { field: 'startedAt', direction: 'DESC' },
    tags: ['production', 'v2'],
    metadata: { customerId: 'abc123' },
  },
  { encode: true, skipNulls: true, arrayFormat: 'indices' },
);

// Produces: page=0&perPage=20&entityType=agent&entityId=weatherAgent&status=success&startedAt[start]=...&orderBy[field]=startedAt&orderBy[direction]=DESC&tags[0]=production&tags[1]=v2&metadata[customerId]=abc123

// Server: parse and restructure into schema shape
const parsed = qs.parse(queryString, { ignoreQueryPrefix: true, depth: 2 });
// Move scalar filters into filters object, page/perPage into pagination, then validate with Zod
```

See `packages/core/src/storage/docs/query-params-design.md` for full details.

## Related Files

- `packages/server/src/server/schemas/common.ts` - Pagination schemas
- `packages/server/src/server/schemas/memory.ts` - JSON preprocess examples
- `packages/core/src/storage/schemas/observability.ts` - qs-based implementation
- `packages/core/src/storage/docs/query-params-design.md` - Observability API design

# Query Parameter Handling Bugs

This document tracks inconsistencies between the client SDK and server schemas for complex query parameters.

## Background

For complex types (objects, arrays) in query parameters:

- **Client** should send: `JSON.stringify(value)`
- **Server** should use: `z.preprocess()` with `JSON.parse()` to convert string back to object

## Current Issues

### 1. `LIST_MESSAGES_ROUTE` - `orderBy` param is broken

**Endpoint:** `GET /api/memory/threads/:threadId/messages`

**Client** (`client-sdks/client-js/src/resources/memory-thread.ts:79`):

```typescript
if (orderBy) queryParams.orderBy = JSON.stringify(orderBy);
```

**Server** (`packages/server/src/server/schemas/memory.ts:148`):

```typescript
orderBy: storageOrderBySchema.optional(),  // NO z.preprocess!
```

**Problem:** Client sends JSON string, server expects object. Zod validation likely fails or `orderBy` is ignored.

**Fix:** Wrap `storageOrderBySchema` with `z.preprocess`:

```typescript
const storageOrderBySchema = z
  .preprocess(
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
    z.object({
      field: z.enum(['createdAt', 'updatedAt']).optional(),
      direction: z.enum(['ASC', 'DESC']).optional(),
    }),
  )
  .optional();
```

---

### 2. `LIST_THREADS_ROUTE` - `orderBy` param mismatch

**Endpoint:** `GET /api/memory/threads`

**Client** (`client-sdks/client-js/src/client.ts:112-113`):

```typescript
...(params.orderBy && { orderBy: params.orderBy }),        // flat string: 'createdAt'
...(params.sortDirection && { sortDirection: params.sortDirection }),  // separate param
```

**Client types** (`client-sdks/client-js/src/types.ts:278-279`):

```typescript
orderBy?: 'createdAt' | 'updatedAt';
sortDirection?: 'ASC' | 'DESC';
```

**Server** (`packages/server/src/server/schemas/memory.ts:134`):

```typescript
orderBy: storageOrderBySchema.optional(),  // Expects { field, direction } object
```

**Problem:** Client sends flat params (`orderBy=createdAt&sortDirection=DESC`), server expects nested object `{ field: 'createdAt', direction: 'DESC' }`.

**Fix options:**

1. Change client to send `orderBy: JSON.stringify({ field: 'createdAt', direction: 'DESC' })` and add `z.preprocess` on server
2. Change server to accept flat params and reconstruct object in handler
3. Keep client API but transform in client before sending

---

## Correctly Implemented Examples

These schemas correctly handle complex query params:

### `includeSchema` (memory.ts:27-48)

```typescript
const includeSchema = z.preprocess(
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
  z.array(...).optional(),
);
```

### `filterSchema` (memory.ts:53-74)

```typescript
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
  z.object({...}).optional(),
);
```

### `memoryConfigSchema` (memory.ts:79-88)

```typescript
const memoryConfigSchema = z.preprocess(val => {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return undefined;
    }
  }
  return val;
}, z.record(z.string(), z.unknown()).optional());
```

---

## Recommendation

Create a reusable helper for JSON query param preprocessing:

```typescript
function jsonQueryParam<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(val => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return undefined;
      }
    }
    return val;
  }, schema);
}

// Usage:
const storageOrderBySchema = jsonQueryParam(
  z
    .object({
      field: z.enum(['createdAt', 'updatedAt']).optional(),
      direction: z.enum(['ASC', 'DESC']).optional(),
    })
    .optional(),
);
```

# HTTP Query Parameter Handling

This document explains how complex types are handled in HTTP query parameters for Mastra server routes.

## The Challenge

HTTP query strings only support string values. When an API needs to accept complex types (arrays, objects, nested structures), we need a strategy to:

1. **Serialize** complex values on the client side
2. **Deserialize** them on the server side
3. **Validate** the resulting data
4. **Report errors** clearly when validation fails

## Our Approach

### Client Side: JSON.stringify

Clients send complex values as JSON strings in query parameters:

```typescript
// Client SDK example
const queryParams = new URLSearchParams();
queryParams.set('tags', JSON.stringify(['tag1', 'tag2']));
queryParams.set('startedAt', JSON.stringify({ gte: '2024-01-01' }));
queryParams.set('perPage', '10'); // Simple values stay as strings

fetch(`/api/observability/traces?${queryParams.toString()}`);
// → /api/observability/traces?tags=["tag1","tag2"]&startedAt={"gte":"2024-01-01"}&perPage=10
```

### Server Side: wrapSchemaForQueryParams + Zod Validation

The server uses a two-layer approach:

```
Query String → wrapSchemaForQueryParams (JSON.parse) → Base Schema Validation → Typed Object
```

#### Layer 1: JSON Parsing (wrapSchemaForQueryParams)

Automatically wraps complex fields to parse JSON strings:

```typescript
import { wrapSchemaForQueryParams } from '../server-adapter/routes/route-builder';

// Base schema (used by storage layer, expects objects)
const tracesFilterSchema = z.object({
  tags: z.array(z.string()).optional(),
  startedAt: dateRangeSchema.optional(),
  perPage: z.coerce.number().optional(),
});

// HTTP schema (accepts JSON strings for complex fields)
const httpTracesFilterSchema = wrapSchemaForQueryParams(tracesFilterSchema);
```

The `wrapSchemaForQueryParams` function:

- Iterates through schema fields
- Detects complex types (arrays, objects, records)
- Wraps them with `jsonQueryParam()` to handle JSON string input
- Leaves simple types (string, number, boolean, enum) unchanged

#### Layer 2: Base Schema Validation

After JSON parsing, the base schema validation runs:

```typescript
// These validations are defined in base schemas and run automatically:
perPage: z.coerce.number().int().min(1).max(1000); // Range validation
startedAt: z.object({
  gte: z.coerce.date(), // ISO string → Date conversion
  lte: z.coerce.date(),
});
entityType: z.nativeEnum(EntityType); // Enum validation
```

## Error Handling

All validation errors are collected and returned in a structured format:

```json
{
  "error": "Invalid query parameters",
  "issues": [
    { "field": "tags", "message": "Invalid JSON: Unexpected token" },
    { "field": "perPage", "message": "Number must be less than or equal to 1000" },
    { "field": "startedAt.gte", "message": "Invalid date" },
    { "field": "entityType", "message": "Invalid enum value" }
  ]
}
```

This is achieved by:

1. Using `ctx.addIssue()` in the `jsonQueryParam` transform for JSON parse errors
2. Zod's built-in error collection for schema validation errors
3. Server adapters (Hono/Express) formatting `ZodError` into the structured response

## Usage Pattern

### Defining a Route

```typescript
import { createRoute, pickParams, wrapSchemaForQueryParams } from '../server-adapter/routes/route-builder';
import { tracesFilterSchema, paginationArgsSchema, tracesOrderBySchema } from '@mastra/core/storage';

// Combine and wrap schemas for HTTP
const httpListTracesQuerySchema = wrapSchemaForQueryParams(
  tracesFilterSchema.merge(paginationArgsSchema).merge(tracesOrderBySchema).partial(),
);

export const LIST_TRACES_ROUTE = createRoute({
  method: 'GET',
  path: '/api/observability/traces',
  responseType: 'json',
  queryParamSchema: httpListTracesQuerySchema,
  handler: async ({ mastra, ...params }) => {
    // params are fully parsed and validated at this point
    // Use pickParams to separate concerns
    const filters = pickParams(tracesFilterSchema, params);
    const pagination = pickParams(paginationArgsSchema, params);
    const orderBy = pickParams(tracesOrderBySchema, params);

    return storage.listTraces({ filters, pagination, orderBy });
  },
});
```

### Type Flow

```
Input (query string)     →  HTTP Schema Parse  →  Handler Params  →  Storage Call
─────────────────────────────────────────────────────────────────────────────────
tags: '["a","b"]'        →  tags: ["a","b"]    →  filters.tags    →  same
startedAt: '{"gte":...}' →  startedAt: {...}   →  filters.start.. →  same
perPage: '10'            →  perPage: 10        →  pagination...   →  same
```

## Complex Type Detection

`wrapSchemaForQueryParams` automatically detects these as complex types needing JSON parsing:

| Zod Type        | Example                | Needs JSON?       |
| --------------- | ---------------------- | ----------------- |
| `ZodArray`      | `z.array(z.string())`  | Yes               |
| `ZodRecord`     | `z.record(z.string())` | Yes               |
| `ZodObject`     | `z.object({...})`      | Yes               |
| `ZodString`     | `z.string()`           | No                |
| `ZodNumber`     | `z.number()`           | No (use z.coerce) |
| `ZodBoolean`    | `z.boolean()`          | No (use z.coerce) |
| `ZodEnum`       | `z.enum([...])`        | No                |
| `ZodNativeEnum` | `z.nativeEnum(Enum)`   | No                |

Wrapped types (`ZodOptional`, `ZodNullable`) are unwrapped to check the inner type.

## Best Practices

### Base Schema Design

1. **Use `z.coerce` for primitives** that come from query strings:

   ```typescript
   perPage: z.coerce.number().int().min(1).max(1000);
   enabled: z.coerce.boolean();
   startDate: z.coerce.date();
   ```

2. **Add validation constraints** in base schemas:

   ```typescript
   page: z.coerce.number().int().min(0); // Non-negative integer
   limit: z.coerce.number().int().min(1).max(100); // Bounded range
   ```

3. **Use descriptive error messages** with `.describe()`:
   ```typescript
   perPage: z.coerce.number().int().min(1, 'perPage must be at least 1').max(1000, 'perPage cannot exceed 1000');
   ```

### Client SDK Design

1. **Always JSON.stringify complex values**:

   ```typescript
   if (orderBy) queryParams.orderBy = JSON.stringify(orderBy);
   if (tags) queryParams.tags = JSON.stringify(tags);
   ```

2. **Simple values as strings**:
   ```typescript
   if (page !== undefined) queryParams.page = String(page);
   if (perPage !== undefined) queryParams.perPage = String(perPage);
   ```

## Files Reference

| File                                                                | Purpose                                                          |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `packages/server/src/server/server-adapter/routes/route-builder.ts` | `jsonQueryParam()`, `wrapSchemaForQueryParams()`, `pickParams()` |
| `packages/core/src/storage/domains/shared.ts`                       | Base schemas with coercion and validation                        |
| `server-adapters/hono/src/index.ts`                                 | Hono adapter with ZodError formatting                            |
| `server-adapters/express/src/index.ts`                              | Express adapter with ZodError formatting                         |

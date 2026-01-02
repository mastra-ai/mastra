---
name: api-design
description: Guidelines for designing RESTful APIs and TypeScript interfaces. Use when designing new endpoints, reviewing API contracts, or structuring data models.
license: MIT
---

# API Design Guidelines

## Overview

This skill provides guidelines for designing clean, consistent APIs. Apply these patterns when creating new endpoints, defining TypeScript interfaces, or reviewing API contracts.

**Keywords**: API design, REST, endpoints, TypeScript interfaces, data modeling, HTTP methods, response formats

## REST Endpoint Design

### URL Structure

```
/{resource}                    # Collection
/{resource}/{id}               # Single resource
/{resource}/{id}/{sub-resource} # Nested resource
```

**Good examples:**

- `GET /users` - List users
- `GET /users/123` - Get user 123
- `POST /users/123/orders` - Create order for user 123

**Avoid:**

- `/getUsers` - Don't use verbs in URLs
- `/user/list` - Don't use action words
- `/users/123/getOrders` - HTTP method implies action

### HTTP Methods

| Method | Purpose          | Idempotent | Body |
| ------ | ---------------- | ---------- | ---- |
| GET    | Read resource    | Yes        | No   |
| POST   | Create resource  | No         | Yes  |
| PUT    | Replace resource | Yes        | Yes  |
| PATCH  | Update resource  | No         | Yes  |
| DELETE | Remove resource  | Yes        | No   |

### Response Codes

**Success:**

- `200` - OK (GET, PUT, PATCH with body)
- `201` - Created (POST)
- `204` - No Content (DELETE, PUT/PATCH without body)

**Client errors:**

- `400` - Bad Request (validation failed)
- `401` - Unauthorized (no/invalid auth)
- `403` - Forbidden (no permission)
- `404` - Not Found
- `409` - Conflict (duplicate, state conflict)
- `422` - Unprocessable Entity (semantic errors)

**Server errors:**

- `500` - Internal Server Error
- `503` - Service Unavailable

## Response Formats

### Success Response

```typescript
// Single resource
{
  "data": {
    "id": "123",
    "name": "Example",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}

// Collection
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

### Error Response

```typescript
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

## TypeScript Interface Design

### Naming Conventions

```typescript
// Entities use PascalCase nouns
interface User {}
interface OrderItem {}

// Request/Response types include suffix
interface CreateUserRequest {}
interface GetUserResponse {}

// Params types for function arguments
interface ListUsersParams {}
```

### Required vs Optional

```typescript
// Required fields: always present
interface User {
  id: string;
  email: string;
  createdAt: Date;
}

// Optional fields: may be undefined
interface CreateUserRequest {
  email: string;
  name?: string; // Optional
  metadata?: Record<string, unknown>;
}
```

### Discriminated Unions

Use for type-safe variants:

```typescript
type PaymentMethod =
  | { type: 'card'; cardNumber: string; expiry: string }
  | { type: 'bank'; accountNumber: string; routingNumber: string }
  | { type: 'crypto'; walletAddress: string };

// Usage
function processPayment(method: PaymentMethod) {
  switch (method.type) {
    case 'card':
      // TypeScript knows cardNumber exists
      return chargeCard(method.cardNumber);
    case 'bank':
      return initiateTransfer(method.accountNumber);
    case 'crypto':
      return sendCrypto(method.walletAddress);
  }
}
```

## Pagination

### Offset-based (Simple)

```typescript
interface PaginationParams {
  page?: number; // Default: 1
  pageSize?: number; // Default: 20, max: 100
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
```

### Cursor-based (Scalable)

```typescript
interface CursorParams {
  cursor?: string;
  limit?: number;
}

interface CursorResponse<T> {
  data: T[];
  meta: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}
```

## Versioning

### URL Versioning (Recommended)

```
/api/v1/users
/api/v2/users
```

### Header Versioning

```
Accept: application/vnd.api+json; version=2
```

## Common Patterns

### Filtering

```
GET /users?status=active&role=admin
GET /orders?createdAfter=2024-01-01&createdBefore=2024-02-01
```

### Sorting

```
GET /users?sort=createdAt:desc
GET /users?sort=lastName:asc,firstName:asc
```

### Field Selection

```
GET /users?fields=id,name,email
GET /users/123?include=orders,profile
```

## Security Considerations

1. **Authentication** - Use Bearer tokens in Authorization header
2. **Rate limiting** - Include `X-RateLimit-*` headers
3. **Input validation** - Validate all request bodies with schemas
4. **Output encoding** - Escape HTML in responses if rendered
5. **CORS** - Configure allowed origins explicitly

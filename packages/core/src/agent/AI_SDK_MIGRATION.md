# AI SDK v4 → v5 Migration Guide

This guide explains how to migrate from AI SDK v4 to v5 using Mastra's built-in compatibility features.

## Overview

Mastra now includes built-in backwards compatibility for AI SDK v4, allowing you to upgrade Mastra while keeping your frontend applications working unchanged. This provides a gradual migration path without breaking changes.

## Quick Start

### 1. Zero-Breaking-Change Upgrade

```typescript
import { Mastra } from '@mastra/core';

export const mastra = new Mastra({
  agents: { myAgent },

  // Enable v4 compatibility mode - your frontend keeps working!
  aiSdkCompat: 'v4',

  // ... other config
});
```

### 2. Gradual Migration

```typescript
export const mastra = new Mastra({
  agents: { myAgent },

  // Auto-detect mode: use headers/query params to control per request
  aiSdkCompat: 'auto',
});
```

### 3. Full v5 Migration

```typescript
export const mastra = new Mastra({
  agents: { myAgent },

  // Pure v5 mode (default) - best performance
  aiSdkCompat: 'v5', // or omit entirely
});
```

## Configuration Options

### `aiSdkCompat` Values

- **`'v4'`** - Always return v4-compatible streams and responses
- **`'v5'`** - Use native v5 format (default, recommended for new projects)
- **`'auto'`** - Auto-detect based on client headers or query parameters

### Auto-Detection Headers

When using `aiSdkCompat: 'auto'`, clients can specify format via:

```http
# Header approach
X-AI-SDK-Version: v4

# Query parameter approach
GET /api/agents/myAgent/stream?aisdk=v4
```

## API Compatibility

### Stream Endpoints

Both stream endpoints automatically respect the compatibility mode:

```typescript
// These endpoints now support compatibility detection:
POST / api / agents / { id } / stream; // Agent streaming
GET / api / memory / threads / { id } / messages; // Memory messages
```

### Memory API

The memory API automatically detects and returns appropriate message formats:

```typescript
// Explicit format override
GET /api/memory/threads/123/messages?format=aiv4

// Auto-detection based on aiSdkCompat config
GET /api/memory/threads/123/messages
```

## Client Integration

### Using with Client Libraries

```typescript
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({
  baseUrl: 'https://api.example.com',
});

// Get v4 format explicitly
const messages = await client.getMemoryThread('threadId', 'agentId').getMessages({ format: 'aiv4' });

// Or rely on server auto-detection
const messages = await client.getMemoryThread('threadId', 'agentId').getMessages();
```

### Custom Headers

```typescript
fetch('/api/agents/myAgent/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-AI-SDK-Version': 'v4', // Request v4 compatibility
  },
  body: JSON.stringify({ messages }),
});
```

## Migration Strategies

### Strategy 1: Immediate Compatibility

Perfect for production systems that need zero downtime:

1. Upgrade Mastra packages
2. Set `aiSdkCompat: 'v4'`
3. Deploy backend
4. Frontend continues working unchanged
5. Migrate frontend at your own pace

### Strategy 2: Feature-Flag Migration

Ideal for testing and gradual rollout:

1. Set `aiSdkCompat: 'auto'`
2. Use headers/query params to control per-request
3. Test v5 format on subset of requests
4. Gradually migrate to full v5

### Strategy 3: Clean Migration

For new projects or major refactors:

1. Upgrade everything to v5 at once
2. Use `aiSdkCompat: 'v5'` or omit config
3. Best performance and latest features

## Examples

### Enterprise Migration

```typescript
// mastra.config.ts
export const mastra = new Mastra({
  agents: { customerServiceAgent, analyticsAgent },

  // Start with v4 compatibility for safety
  aiSdkCompat: process.env.ENABLE_AI_SDK_V5 === 'true' ? 'v5' : 'v4',

  storage: new PostgresStore({
    /* ... */
  }),
});
```

### Development Environment

```typescript
// mastra.config.ts
export const mastra = new Mastra({
  agents: { myAgent },

  // Use auto-detection for flexible testing
  aiSdkCompat: 'auto',
});

// Test v4 compatibility:
// curl -H "X-AI-SDK-Version: v4" http://localhost:3000/api/agents/myAgent/stream

// Test v5 native:
// curl -H "X-AI-SDK-Version: v5" http://localhost:3000/api/agents/myAgent/stream
```

## Performance Considerations

- **v5 mode**: Best performance, no transformation overhead
- **v4 mode**: Slight overhead for stream transformation
- **auto mode**: Minimal detection overhead per request

## Troubleshooting

### Empty Message Bubbles

If you see empty message bubbles, ensure:

1. Memory API is using correct format (`?format=aiv4`)
2. `aiSdkCompat` is set correctly
3. Client headers are being sent properly

### Stream Format Issues

If streams aren't working:

1. Check `aiSdkCompat` configuration
2. Verify client sends appropriate headers
3. Test with explicit `?aisdk=v4` query parameter

## Next Steps

1. **Phase 1**: Implement `aiSdkCompat: 'v4'` for immediate compatibility
2. **Phase 2**: Test with `aiSdkCompat: 'auto'` and client headers
3. **Phase 3**: Migrate frontend to v5 and use `aiSdkCompat: 'v5'`

For more details, see the [full documentation](../../../docs) or check the examples in `/examples/agent/`.

# ID Generator

This module provides consistent ID generation across the Mastra ecosystem using Vercel AI SDK's ID generation utilities.

## Usage Patterns

### 1. Default Usage (Most Common)

```typescript
import { generateId } from 'ai';

const id = generateId(); // Generates a 16-character nanoid
console.log(id); // Example: "V1StGXR8_Z5jdHi6"
```

### 2. Prefixed IDs (When Needed for Debugging)

```typescript
import { createIdGenerator } from 'ai';

// Use prefixes for workflow steps and run instances (helpful for debugging)
const generateSleepId = createIdGenerator({ prefix: 'sleep' });
const generateMappingId = createIdGenerator({ prefix: 'mapping' });
const generateRunId = createIdGenerator({ prefix: 'run' });

console.log(generateSleepId());    // Example: "sleep-V1StGXR8_Z5jdHi6"
console.log(generateMappingId());  // Example: "mapping-B2QvGXR9_A6keIj7"
console.log(generateRunId());      // Example: "run-C3RwHXS0_B7lfJk8"

// For message IDs, use simple generateId() for consistency
import { generateId } from 'ai';
const messageId = generateId(); // Example: "V1StGXR8_Z5jdHi6"
```

### 3. Custom Configuration

```typescript
import { createIdGenerator } from 'ai';

// Custom separator and size
const generateUserId = createIdGenerator({
  prefix: 'user',
  separator: '_',
  size: 8
});

console.log(generateUserId()); // Example: "user_A1B2C3D4"
```

### 4. Advanced Custom Algorithm (Mastra Config)

For special requirements like ULID, configure at the Mastra level:

```typescript
import { ulid } from 'ulid';
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  generateId: () => ulid(), // Custom algorithm
  // ... other config
});
```

## Component Usage Examples

### Agent Messages

```typescript
import { generateId } from 'ai';

class Agent {
  async generate(prompt: string) {
    const messageId = generateId(); // Simple, consistent with other message IDs
    // Use messageId for message storage
  }
}
```

### Workflow Runs

```typescript
import { createIdGenerator } from 'ai';

class Workflow {
  private generateRunId = createIdGenerator({ prefix: 'run' });
  
  async execute() {
    const runId = this.generateRunId();
    // Use runId for workflow execution tracking
  }
}
```

## Benefits

1. **Consistency**: All IDs follow the same format across Mastra
2. **Compatibility**: Fully compatible with Vercel AI SDK patterns
3. **Flexibility**: Easy to customize for specific needs
4. **Performance**: Uses fast, non-cryptographic random generation
5. **Readability**: Prefixed IDs make debugging easier

## Migration from UUID

If you were previously using `crypto.randomUUID()`:

```typescript
// Before
import { randomUUID } from 'crypto';
const id = randomUUID();

// After
import { generateId } from 'ai';
const id = generateId();
```

The new IDs are shorter (16 vs 36 characters) and URL-safe, making them more suitable for modern applications.

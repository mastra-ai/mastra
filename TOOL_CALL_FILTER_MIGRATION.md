# ToolCallFilter Migration Guide

## Overview

`ToolCallFilter` has been migrated from the old `MemoryProcessor` system to the new `InputProcessor` interface. The old version in `@mastra/memory` is now deprecated and will be removed in a future version.

## Migration Path

### Old Usage (Deprecated)

```typescript
import { ToolCallFilter } from '@mastra/memory';
import { Agent, Memory } from '@mastra/core';

const memory = new Memory({
  processors: [
    new ToolCallFilter(), // Exclude all tool calls
    // or
    new ToolCallFilter({ exclude: ['weather'] }), // Exclude specific tools
  ],
});

const agent = new Agent({ memory });
```

### New Usage (Recommended)

```typescript
import { ToolCallFilter } from '@mastra/core/processors';
import { Agent, Memory } from '@mastra/core';

const memory = new Memory({
  // Memory configuration only
  lastMessages: 10,
});

const agent = new Agent({
  memory,
  inputProcessors: [
    new ToolCallFilter(), // Exclude all tool calls
    // or
    new ToolCallFilter({ exclude: ['weather'] }), // Exclude specific tools
  ],
});
```

## Key Differences

### 1. Import Path

- **Old**: `import { ToolCallFilter } from '@mastra/memory'`
- **New**: `import { ToolCallFilter } from '@mastra/core/processors'`

### 2. Configuration Location

- **Old**: Configured in `Memory({ processors: [...] })`
- **New**: Configured in `Agent({ inputProcessors: [...] })`

### 3. Message Format

- **Old**: Works with `CoreMessage` (AI SDK format)
- **New**: Works with `MastraMessageV2` (internal format)

The new processor automatically handles the internal message format, so no changes are needed to your configuration.

## Behavior

The behavior remains the same:

### Default Behavior (No Arguments)

Excludes **all** tool calls and their results from the message history:

```typescript
new ToolCallFilter();
```

### Exclude Specific Tools

Excludes only the specified tools by name:

```typescript
new ToolCallFilter({ exclude: ['weather', 'search'] });
```

### Keep All Tool Calls

Pass an empty array to keep all tool calls:

```typescript
new ToolCallFilter({ exclude: [] });
```

## Use Cases

### 1. Reduce Token Usage

Exclude tool calls to save tokens when sending context to the LLM:

```typescript
const agent = new Agent({
  memory,
  inputProcessors: [
    new ToolCallFilter(), // Remove all tool calls from history
  ],
});
```

### 2. Hide Sensitive Tool Calls

Exclude specific tools that contain sensitive data:

```typescript
const agent = new Agent({
  memory,
  inputProcessors: [
    new ToolCallFilter({ exclude: ['database_query', 'api_key_fetch'] }),
  ],
});
```

### 3. Simplify Context

Remove complex tool interactions to simplify the context:

```typescript
const agent = new Agent({
  memory,
  inputProcessors: [
    new ToolCallFilter({ exclude: ['complex_calculation', 'data_processing'] }),
  ],
});
```

## Processor Ordering

`ToolCallFilter` is an **input processor**, so it runs **before** the LLM receives messages. It should typically be placed:

1. **After** memory processors (message history, semantic recall)
2. **Before** token limiters or other context processors

Example:

```typescript
const agent = new Agent({
  memory, // Adds MessageHistory, SemanticRecall, WorkingMemory
  inputProcessors: [
    // Memory processors run first (from memory.getInputProcessors())
    new ToolCallFilter({ exclude: ['weather'] }), // Filter tool calls
    new TokenLimiterProcessor(4000), // Then limit tokens
  ],
});
```

## Testing

The new `ToolCallFilter` has comprehensive unit tests covering:

- Excluding all tool calls (default behavior)
- Excluding specific tools by name
- Handling empty exclude arrays
- Edge cases (missing properties, empty arrays, etc.)

All 11 tests pass successfully.

## Timeline

- **Current**: Both old and new versions are available
- **Deprecation**: Old version is marked as `@deprecated`
- **Removal**: Old version will be removed in the next major version

## Questions?

If you have any questions or issues with the migration, please open an issue on GitHub.

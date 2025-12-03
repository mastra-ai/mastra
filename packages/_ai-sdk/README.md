# @internal/ai-sdk

Unified internal vendor package for all AI SDK versions. This package provides a stable abstraction layer over Vercel AI SDK dependencies.

## Supported Versions

### V4 (LanguageModelV1)

- `ai@4.x`
- `@ai-sdk/provider@1.x`
- `@ai-sdk/provider-utils@2.x`

### V5 (LanguageModelV2)

- `ai@5.x`
- `@ai-sdk/provider@2.x`
- `@ai-sdk/provider-utils@3.x`

## Usage

### Import specific version

```typescript
// V4 imports (LanguageModelV1)
import { LanguageModelV1, generateText, streamText } from '@internal/ai-sdk/v4';
import { MockLanguageModelV1 } from '@internal/ai-sdk/v4/test';

// V5 imports (LanguageModelV2)
import { LanguageModelV2, generateText, streamText } from '@internal/ai-sdk/v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk/v5/test';
```

### Import via namespace

```typescript
import { v4, v5 } from '@internal/ai-sdk';

const modelV1: v4.LanguageModelV1 = ...;
const modelV2: v5.LanguageModelV2 = ...;
```

## Purpose

This package isolates AI SDK dependencies to:

1. Provide a stable interface that won't break when upgrading AI SDK versions
2. Allow gradual migration between AI SDK versions
3. Centralize all AI SDK imports in one place
4. Support running multiple AI SDK versions side-by-side

## Module Structure

```
@internal/ai-sdk
├── /v4              # AI SDK v4 (LanguageModelV1)
│   ├── index.ts     # Main v4 exports
│   ├── model.ts     # Model types and generation functions
│   ├── message.ts   # Message types
│   ├── tool.ts      # Tool types
│   ├── embed.ts     # Embedding utilities
│   ├── schema.ts    # Schema utilities
│   ├── test.ts      # Test utilities
│   └── util.ts      # General utilities
└── /v5              # AI SDK v5 (LanguageModelV2)
    ├── index.ts     # Main v5 exports
    ├── model.ts     # Model types and generation functions
    ├── provider.ts  # Provider types
    ├── provider-utils.ts # Provider utilities
    ├── message.ts   # Message types
    ├── tool.ts      # Tool types
    ├── embed.ts     # Embedding utilities
    ├── voice.ts     # Voice/speech utilities
    ├── stream.ts    # Stream utilities
    ├── schema.ts    # Schema utilities
    ├── test.ts      # Test utilities
    └── errors.ts    # Error types
```

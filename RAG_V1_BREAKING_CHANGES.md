# RAG Package v1.0 Breaking Changes Plan

**Target Release: v1.0**
**Context: This plan assumes breaking changes are acceptable for a major version release.**

---

## Executive Summary

| Category                                      | Count     | Breaking? | Status           |
| --------------------------------------------- | --------- | --------- | ---------------- |
| Remove deprecated `size` parameter            | 1         | ✅ Yes    | ✅ DONE          |
| Remove deprecated vector prompts              | 9 exports | ✅ Yes    | ✅ DONE          |
| Rename `keepSeparator` to `separatorPosition` | 1         | ✅ Yes    | ✅ DONE          |
| Restructure chunk API to nested options       | 1         | ✅ Yes    | ⏳ TODO          |
| **Total Breaking Changes**                    | **12**    | -         | **3/4 Complete** |

---

## Table of Contents

1. [Deprecated Code to Remove](#1-deprecated-code-to-remove) ✅ DONE
2. [Chunk API Improvements](#2-chunk-api-improvements) ⏳ IN PROGRESS
3. [Implementation Checklist](#3-implementation-checklist)
4. [Migration Guide](#4-migration-guide)

---

## 1. Deprecated Code to Remove

### 1.1 Remove `size` Parameter from Chunk Options ✅ DONE

**Location:** [packages/rag/src/document/types.ts:46](packages/rag/src/document/types.ts#L46)
**Breaking:** ✅ Yes
**Status:** ✅ Completed

**What Was Done:**

1. ✅ Removed `size` property from `BaseChunkOptions` type definition
2. ✅ Deleted `handleDeprecatedSize` function from validation.ts
3. ✅ Removed `size` from Zod schema in baseChunkOptionsSchema
4. ✅ Removed all `.transform(handleDeprecatedSize)` calls

**Current State:**

```typescript
export type BaseChunkOptions = {
  maxSize?: number; // size parameter completely removed
  overlap?: number;
  lengthFunction?: (text: string) => number;
  separatorPosition?: 'start' | 'end';
  addStartIndex?: boolean;
  stripWhitespace?: boolean;
};
```

**Migration Path:**

```typescript
// Before (v0.x)
await doc.chunk({ size: 1000 });

// After (v1.0)
await doc.chunk({ maxSize: 1000 });
```

**Files Modified:**

- ✅ `packages/rag/src/document/types.ts` - Removed `size` property
- ✅ `packages/rag/src/document/validation.ts` - Removed deprecation handler
- ⏳ `docs/src/content/en/reference/rag/chunk.mdx` - Documentation still needs update

---

### 1.2 Remove Deprecated Vector Prompts ✅ DONE

**Location:** [packages/rag/src/utils/vector-prompts.ts](packages/rag/src/utils/vector-prompts.ts)
**Breaking:** ✅ Yes
**Status:** ✅ Completed

**What Was Done:**

1. ✅ Deleted entire `packages/rag/src/utils/vector-prompts.ts` file (750+ lines)
2. ✅ Removed export statement from `packages/rag/src/index.ts`

**Removed Exports:**
The following 9 prompts are no longer exported from `@mastra/rag` and must be imported directly from their respective store packages:

1. `ASTRA_PROMPT` → Now in `@mastra/astra/vector/prompt`
2. `CHROMA_PROMPT` → Now in `@mastra/chroma/vector/prompt`
3. `LIBSQL_PROMPT` → Now in `@mastra/libsql/vector/prompt`
4. `PGVECTOR_PROMPT` → Now in `@mastra/pg/vector/prompt`
5. `PINECONE_PROMPT` → Now in `@mastra/pinecone/vector/prompt`
6. `QDRANT_PROMPT` → Now in `@mastra/qdrant/vector/prompt`
7. `UPSTASH_PROMPT` → Now in `@mastra/upstash/vector/prompt`
8. `VECTORIZE_PROMPT` → Now in `@mastra/vectorize/vector/prompt`
9. `MONGODB_PROMPT` → Now in `@mastra/mongodb/vector/prompt`

**Migration Path:**

```typescript
// Before (v0.x)
import { PGVECTOR_PROMPT, CHROMA_PROMPT } from '@mastra/rag';

// After (v1.0)
import { PGVECTOR_PROMPT } from '@mastra/pg/vector/prompt';
import { CHROMA_PROMPT } from '@mastra/chroma/vector/prompt';
```

**Files Modified:**

- ✅ `packages/rag/src/utils/vector-prompts.ts` - **DELETED entire file**
- ✅ `packages/rag/src/index.ts` - Removed export statement

---

## 2. Chunk API Improvements

These improvements address issues from a historical ticket about the chunk API design.

### 2.1 Restructure to Nested Strategy Options ⏳ TODO

**Breaking:** ✅ Yes
**Status:** ⏳ Not yet implemented - This is the main remaining v1.0 breaking change

#### Background & Analysis

**Current State (Flat Structure):**

```typescript
await doc.chunk({
  strategy: 'markdown',
  headers: [['#', 'title']], // Strategy-specific
  stripHeaders: true, // Strategy-specific
  maxSize: 500, // General option
  overlap: 50, // General option
});
```

**Problem:**

- Not immediately clear which options are general vs strategy-specific
- All options at the same level creates cognitive overhead
- Potential for naming collisions across strategies
- Harder to extend in the future

**Arguments FOR Nested Structure:**

1. ✅ **Better API Organization** - Clearly separates general options from strategy-specific ones
2. ✅ **Clearer Intent** - Structure itself documents which options belong where
3. ✅ **Industry Standard** - Aligns with webpack, rollup, and other config-heavy tools
4. ✅ **Future Extensibility** - Easy to add strategy-specific features without polluting top level
5. ✅ **Reduced Naming Collisions** - Strategy options can share names across strategies
6. ✅ **Self-Documenting** - The nesting communicates relationships

**Arguments AGAINST Nested Structure:**

1. ❌ **More Verbose** - Adds one extra level of nesting
2. ❌ **Migration Burden** - All existing code needs updates
3. ❌ **Current Type Safety Works** - Discriminated unions provide good autocomplete
4. ❌ **Less Concise** - More characters to type for simple cases

**Conclusion:** The benefits of clearer organization, reduced collisions, and better extensibility outweigh the verbosity cost. This is a major version - the right time to make this change.

#### Proposed v1.0 Structure

**Recommended Approach: Named Strategy Options**

```typescript
await doc.chunk({
  strategy: 'markdown',
  maxSize: 500, // General option (top level)
  overlap: 50, // General option (top level)
  markdownOptions: {
    // Strategy-specific (nested)
    headers: [['#', 'title']],
    stripHeaders: true,
  },
});

await doc.chunk({
  strategy: 'sentence',
  maxSize: 500,
  sentenceOptions: {
    minSize: 50,
    sentenceEnders: ['.'],
    fallbackToCharacters: false,
  },
});
```

**Why Named Options Over Generic `strategyOptions`?**

- Better TypeScript autocomplete (knows exact shape per strategy)
- Self-documenting (you see it's markdown-specific)
- Prevents mistakes (can't pass HTML options to markdown strategy)
- Industry standard pattern

#### Type System Changes

**Current Type Structure** ([types.ts:136-145](packages/rag/src/document/types.ts#L136-L145)):

```typescript
export type ChunkParams =
  | ({ strategy?: 'character' } & CharacterChunkOptions & { extract?: ExtractParams })
  | ({ strategy: 'recursive' } & RecursiveChunkOptions & { extract?: ExtractParams })
  | ({ strategy: 'markdown' } & MarkdownChunkOptions & { extract?: ExtractParams });
// ... etc
```

**Proposed v1.0 Type Structure:**

```typescript
// 1. Extract general options (apply to all strategies)
export type GeneralChunkOptions = {
  maxSize?: number;
  overlap?: number;
  lengthFunction?: (text: string) => number;
  separatorPosition?: 'start' | 'end' | 'remove'; // Note: renamed from keepSeparator (see 2.2)
  addStartIndex?: boolean;
  stripWhitespace?: boolean;
};

// 2. Define strategy-specific options (without base options)
export type MarkdownStrategyOptions = {
  headers?: [string, string][];
  returnEachLine?: boolean;
  stripHeaders?: boolean;
};

export type CharacterStrategyOptions = {
  separator?: string;
  isSeparatorRegex?: boolean;
};

export type SentenceStrategyOptions = {
  maxSize: number; // Required for sentence strategy!
  minSize?: number;
  targetSize?: number;
  sentenceEnders?: string[];
  fallbackToWords?: boolean;
  fallbackToCharacters?: boolean;
};

export type HTMLStrategyOptions = (
  | { headers: [string, string][]; sections?: never; returnEachLine?: boolean }
  | { sections: [string, string][]; headers?: never }
) & { returnEachLine?: boolean };

export type TokenStrategyOptions = {
  encodingName?: TiktokenEncoding;
  modelName?: TiktokenModel;
  allowedSpecial?: Set<string> | 'all';
  disallowedSpecial?: Set<string> | 'all';
};

export type RecursiveStrategyOptions = {
  separators?: string[];
  isSeparatorRegex?: boolean;
  language?: Language;
};

export type SemanticMarkdownStrategyOptions = {
  joinThreshold?: number;
  encodingName?: TiktokenEncoding;
  modelName?: TiktokenModel;
  allowedSpecial?: Set<string> | 'all';
  disallowedSpecial?: Set<string> | 'all';
};

export type JsonStrategyOptions = {
  minSize?: number;
  ensureAscii?: boolean;
  convertLists?: boolean;
};

export type LatexStrategyOptions = {};

// 3. Create discriminated union with nested options
export type ChunkParams =
  | ({ strategy?: 'character'; characterOptions?: CharacterStrategyOptions } & GeneralChunkOptions & {
        extract?: ExtractParams;
      })
  | ({ strategy: 'recursive'; recursiveOptions?: RecursiveStrategyOptions } & GeneralChunkOptions & {
        extract?: ExtractParams;
      })
  | ({ strategy: 'markdown'; markdownOptions?: MarkdownStrategyOptions } & GeneralChunkOptions & {
        extract?: ExtractParams;
      })
  | ({ strategy: 'html'; htmlOptions?: HTMLStrategyOptions } & GeneralChunkOptions & { extract?: ExtractParams })
  | ({ strategy: 'json'; jsonOptions?: JsonStrategyOptions } & GeneralChunkOptions & { extract?: ExtractParams })
  | ({ strategy: 'latex'; latexOptions?: LatexStrategyOptions } & GeneralChunkOptions & { extract?: ExtractParams })
  | ({ strategy: 'sentence'; sentenceOptions?: SentenceStrategyOptions } & Omit<GeneralChunkOptions, 'maxSize'> & {
        extract?: ExtractParams;
      })
  | ({
      strategy: 'semantic-markdown';
      semanticMarkdownOptions?: SemanticMarkdownStrategyOptions;
    } & GeneralChunkOptions & { extract?: ExtractParams })
  | ({ strategy: 'token'; tokenOptions?: TokenStrategyOptions } & GeneralChunkOptions & { extract?: ExtractParams });
```

**Note on Sentence Strategy:**
The sentence strategy requires `maxSize` as a parameter, so it's defined in `SentenceStrategyOptions` rather than using the general `maxSize`. We omit `maxSize` from `GeneralChunkOptions` for this strategy to avoid duplication.

#### Implementation Changes

**1. Update document.ts chunk method** ([packages/rag/src/document/document.ts](packages/rag/src/document/document.ts))

```typescript
async chunk(params?: ChunkParams): Promise<Chunk[]> {
  const {
    strategy: passedStrategy,
    extract,
    // Extract all strategy-specific option objects
    characterOptions,
    recursiveOptions,
    markdownOptions,
    htmlOptions,
    jsonOptions,
    latexOptions,
    sentenceOptions,
    semanticMarkdownOptions,
    tokenOptions,
    // Everything else is general options
    ...generalOptions
  } = params || {};

  const strategy = passedStrategy || this.defaultStrategy();

  // Map strategy to its specific options
  const strategyOptionsMap = {
    character: characterOptions,
    recursive: recursiveOptions,
    markdown: markdownOptions,
    html: htmlOptions,
    json: jsonOptions,
    latex: latexOptions,
    sentence: sentenceOptions,
    'semantic-markdown': semanticMarkdownOptions,
    token: tokenOptions,
  };

  const strategyOptions = strategyOptionsMap[strategy] || {};

  // Merge general and strategy-specific options
  const chunkOptions = { ...generalOptions, ...strategyOptions };

  // Validate merged options
  validateChunkParams(strategy, chunkOptions);

  // Apply chunking strategy
  await this.chunkBy(strategy, chunkOptions);

  // Extract metadata if requested
  if (extract) {
    await this.extractMetadata(extract);
  }

  return this.chunks;
}
```

**2. Update validation** ([packages/rag/src/document/validation.ts](packages/rag/src/document/validation.ts))

No changes needed to validation schemas - they still validate the merged options object.

**3. Update all documentation** ([docs/src/content/en/reference/rag/chunk.mdx](docs/src/content/en/reference/rag/chunk.mdx))

Rewrite all examples to show nested structure.

**Files to Modify:**

- `packages/rag/src/document/types.ts` - Restructure type definitions
- `packages/rag/src/document/document.ts` - Update chunk() method
- `docs/src/content/en/reference/rag/chunk.mdx` - Rewrite all examples
- All test files (`.test.ts`, `.spec.ts`) - Update test cases

---

### 2.2 Rename `keepSeparator` to `separatorPosition` ✅ DONE

**Breaking:** ✅ Yes
**Status:** ✅ Completed

#### What Was Done

**Renamed the parameter** from `keepSeparator` (with boolean overloading) to `separatorPosition` (string literals only):

**Before (v0.x):**

```typescript
keepSeparator?: boolean | 'start' | 'end'
```

**After (v1.0):**

```typescript
separatorPosition?: 'start' | 'end'
```

**Key Decision:** We eliminated boolean overloading BUT decided **NOT to add an explicit `'remove'` value**. Instead, `undefined` (not passing the parameter) serves as the "remove separator" option. This is cleaner and more idiomatic than having both `undefined` and `'remove'` do the same thing.

#### Current Implementation

**Type Definition:**

```typescript
export type BaseChunkOptions = {
  maxSize?: number;
  overlap?: number;
  lengthFunction?: (text: string) => number;
  separatorPosition?: 'start' | 'end'; // No 'remove' - undefined handles that
  addStartIndex?: boolean;
  stripWhitespace?: boolean;
};
```

**Validation Schema:**

```typescript
const baseChunkOptionsSchema = z.object({
  maxSize: z.number().positive().optional(),
  overlap: z.number().min(0).optional(),
  lengthFunction: z.function().optional(),
  separatorPosition: z.enum(['start', 'end']).optional(),
  addStartIndex: z.boolean().optional(),
  stripWhitespace: z.boolean().optional(),
});
```

**Transformer Implementation:**

```typescript
function splitTextWithRegex(text: string, separator: string, separatorPosition?: 'start' | 'end'): string[] {
  if (!separator) {
    return text.split('');
  }

  // If no position specified (undefined), remove the separator
  if (!separatorPosition) {
    return text.split(new RegExp(separator)).filter(s => s !== '');
  }

  if (!text) {
    return [];
  }

  // ... rest of implementation for 'start' and 'end' positioning
}
```

#### Migration Path

**Mapping from v0.x to v1.0:**

```
keepSeparator: false   →  (don't pass separatorPosition - undefined)
keepSeparator: true    →  separatorPosition: 'start'
keepSeparator: 'start' →  separatorPosition: 'start'
keepSeparator: 'end'   →  separatorPosition: 'end'
```

**Examples:**

```typescript
// ❌ Before (v0.x) - Remove separator
await doc.chunk({
  strategy: 'character',
  separator: '\n\n',
  keepSeparator: false,
});

// ✅ After (v1.0) - Don't pass separatorPosition
await doc.chunk({
  strategy: 'character',
  separator: '\n\n',
  // separatorPosition not specified = remove separator
});

// ❌ Before (v0.x) - Keep at start
await doc.chunk({
  strategy: 'character',
  separator: '\n\n',
  keepSeparator: true, // or 'start'
});

// ✅ After (v1.0) - Explicit 'start'
await doc.chunk({
  strategy: 'character',
  separator: '\n\n',
  separatorPosition: 'start',
});

// ❌ Before (v0.x) - Keep at end
await doc.chunk({
  strategy: 'character',
  separator: '\n\n',
  keepSeparator: 'end',
});

// ✅ After (v1.0) - Same as before
await doc.chunk({
  strategy: 'character',
  separator: '\n\n',
  separatorPosition: 'end',
});
```

**Files Modified:**

- ✅ `packages/rag/src/document/types.ts` - Renamed in type definition
- ✅ `packages/rag/src/document/validation.ts` - Updated Zod schema
- ✅ `packages/rag/src/document/transformers/character.ts` - Updated implementation
- ✅ `packages/rag/src/document/transformers/text.ts` - Updated base transformer
- ⏳ `docs/src/content/en/reference/rag/chunk.mdx` - Documentation still needs update
- ⏳ Test files - May need updates

---

## 3. Implementation Checklist

### Remove Deprecations ✅ DONE

- [x] **Remove `size` parameter** ✅
  - [x] Remove from `BaseChunkOptions` type
  - [x] Delete `handleDeprecatedSize` function
  - [x] Remove from Zod schema
  - [x] Remove `.transform(handleDeprecatedSize)` calls
  - [ ] Update documentation
  - [ ] Update all test files to use `maxSize`
  - [ ] Run full test suite: `pnpm test:rag`

- [x] **Remove vector prompts** ✅
  - [x] Delete file: `packages/rag/src/utils/vector-prompts.ts`
  - [x] Remove export from `packages/rag/src/index.ts`
  - [x] Search codebase for any internal usages
  - [ ] Run full test suite: `pnpm test:rag`

### Chunk API Improvements ⏳ IN PROGRESS

- [ ] **Restructure to nested options** ⏳ TODO - Main remaining v1.0 task
  - [ ] Create new type definitions in `types.ts`:
    - [ ] Define `GeneralChunkOptions`
    - [ ] Define all `{Strategy}StrategyOptions` types
    - [ ] Update `ChunkParams` discriminated union
  - [ ] Update `chunk()` method in `document.ts`:
    - [ ] Destructure strategy-specific options
    - [ ] Merge general and strategy options
    - [ ] Pass merged options to validation and chunking
  - [ ] Update all test files with new nested structure
  - [ ] Rewrite documentation:
    - [ ] Update `chunk.mdx` with new examples
    - [ ] Update "Strategy-Specific Options" section
    - [ ] Add migration examples
  - [ ] Run full test suite: `pnpm test:rag`
  - [ ] Run type check: `pnpm typecheck:rag`

- [x] **Rename `keepSeparator` to `separatorPosition`** ✅
  - [x] Update in `BaseChunkOptions` type
  - [x] Update Zod schema in `validation.ts`
  - [x] Update `splitTextWithRegex` function in `character.ts`
  - [x] Update base transformer in `text.ts`
  - [x] Update recursive transformer if used
  - [ ] Update all test files
  - [ ] Update documentation in `chunk.mdx`
  - [ ] Run full test suite: `pnpm test:rag`

### Documentation & Testing

- [ ] **Update CHANGELOG**
  - [ ] Document all breaking changes with clear before/after
  - [ ] List all removed exports
  - [ ] Provide migration path for each change

- [ ] **Create migration guide**
  - [ ] Create `packages/rag/MIGRATION_V0_TO_V1.md`
  - [ ] Add examples for each breaking change

- [ ] **Update main documentation**
  - [ ] `/reference/rag/chunk.mdx` - Update all examples
  - [ ] `/reference/rag/extract-params.mdx` - Verify still accurate
  - [ ] `/docs/rag/chunking-and-embedding.mdx` - Update guide examples

- [ ] **Final checks**
  - [ ] Run full build: `pnpm build:rag`
  - [ ] Run all tests: `pnpm test:rag`
  - [ ] Run type check: `pnpm typecheck:rag`
  - [ ] Run linter: `pnpm format`

---

## 4. Migration Guide

### v0.x to v1.0 Migration Examples

#### Change 1: Use `maxSize` instead of `size`

```typescript
// ❌ Before (v0.x)
await doc.chunk({ size: 1000 });

// ✅ After (v1.0)
await doc.chunk({ maxSize: 1000 });
```

#### Change 2: Import vector prompts from store packages

```typescript
// ❌ Before (v0.x)
import { PGVECTOR_PROMPT, CHROMA_PROMPT, PINECONE_PROMPT } from '@mastra/rag';

// ✅ After (v1.0)
import { PGVECTOR_PROMPT } from '@mastra/pg/vector/prompt';
import { CHROMA_PROMPT } from '@mastra/chroma/vector/prompt';
import { PINECONE_PROMPT } from '@mastra/pinecone/vector/prompt';
```

#### Change 3: Use `separatorPosition` instead of `keepSeparator`

```typescript
// ❌ Before (v0.x) - Remove separator
await doc.chunk({
  strategy: 'character',
  separator: '\n\n',
  keepSeparator: false,
});

// ✅ After (v1.0) - Don't pass separatorPosition (undefined = remove)
await doc.chunk({
  strategy: 'character',
  separator: '\n\n',
  // separatorPosition not specified
});

// ❌ Before (v0.x) - Keep at start
await doc.chunk({
  strategy: 'character',
  separator: '\n\n',
  keepSeparator: true, // or 'start'
});

// ✅ After (v1.0) - Explicit 'start'
await doc.chunk({
  strategy: 'character',
  separator: '\n\n',
  separatorPosition: 'start',
});

// ❌ Before (v0.x) - Keep at end
await doc.chunk({
  strategy: 'character',
  separator: '\n\n',
  keepSeparator: 'end',
});

// ✅ After (v1.0) - Same as before
await doc.chunk({
  strategy: 'character',
  separator: '\n\n',
  separatorPosition: 'end',
});
```

**Migration mapping:**

```
keepSeparator: false   →  (don't pass separatorPosition)
keepSeparator: true    →  separatorPosition: 'start'
keepSeparator: 'start' →  separatorPosition: 'start'
keepSeparator: 'end'   →  separatorPosition: 'end'
```

---

#### Change 4 (NOT YET IMPLEMENTED): Use nested strategy options ⏳ TODO

**Note:** This change has not been implemented yet. It is the main remaining v1.0 breaking change.

```typescript
// ❌ Before (v0.x) - Flat structure
await doc.chunk({
  strategy: 'markdown',
  headers: [
    ['#', 'title'],
    ['##', 'section'],
  ],
  stripHeaders: true,
  maxSize: 500,
  overlap: 50,
});

// ✅ After (v1.0) - Nested structure (PLANNED, NOT YET IMPLEMENTED)
await doc.chunk({
  strategy: 'markdown',
  maxSize: 500,
  overlap: 50,
  markdownOptions: {
    headers: [
      ['#', 'title'],
      ['##', 'section'],
    ],
    stripHeaders: true,
  },
});
```

**More examples for each strategy (PLANNED):**

```typescript
// Character strategy
// ❌ Before (v0.x)
await doc.chunk({
  strategy: 'character',
  separator: '\n\n',
  isSeparatorRegex: false,
  maxSize: 300,
});

// ✅ After (v1.0)
await doc.chunk({
  strategy: 'character',
  maxSize: 300,
  characterOptions: {
    separator: '\n\n',
    isSeparatorRegex: false,
  },
});

// Sentence strategy
// ❌ Before (v0.x)
await doc.chunk({
  strategy: 'sentence',
  maxSize: 450,
  minSize: 50,
  sentenceEnders: ['.'],
  fallbackToCharacters: false,
});

// ✅ After (v1.0)
await doc.chunk({
  strategy: 'sentence',
  maxSize: 450, // Still at top level
  sentenceOptions: {
    minSize: 50,
    sentenceEnders: ['.'],
    fallbackToCharacters: false,
  },
});

// HTML strategy
// ❌ Before (v0.x)
await doc.chunk({
  strategy: 'html',
  headers: [
    ['h1', 'title'],
    ['h2', 'subtitle'],
  ],
  returnEachLine: true,
});

// ✅ After (v1.0)
await doc.chunk({
  strategy: 'html',
  htmlOptions: {
    headers: [
      ['h1', 'title'],
      ['h2', 'subtitle'],
    ],
    returnEachLine: true,
  },
});

// Token strategy
// ❌ Before (v0.x)
await doc.chunk({
  strategy: 'token',
  encodingName: 'gpt2',
  modelName: 'gpt-3.5-turbo',
  maxSize: 1000,
});

// ✅ After (v1.0)
await doc.chunk({
  strategy: 'token',
  maxSize: 1000,
  tokenOptions: {
    encodingName: 'gpt2',
    modelName: 'gpt-3.5-turbo',
  },
});
```

---

## Summary

### ✅ Completed Changes (3/4)

1. **Remove deprecated `size` parameter** - DONE
   - Removed from type definitions, validation, and deprecation handlers
   - Users must now use `maxSize` instead

2. **Remove deprecated vector prompts** - DONE
   - Deleted `vector-prompts.ts` file entirely
   - Users must import prompts from individual store packages

3. **Rename `keepSeparator` to `separatorPosition`** - DONE
   - Eliminated boolean overloading
   - Now uses string literals: `'start' | 'end'` (undefined = remove separator)

### ⏳ Remaining Work (1/4)

4. **Restructure chunk API to nested options** - TODO
   - This is the main remaining v1.0 breaking change
   - Requires restructuring all strategy options into nested objects
   - See section 2.1 for full details

### 📝 Other Notes

- **Zod validation for extract parameters** has been separated into a different issue
- Documentation updates are still needed for completed changes
- Tests need to be updated and run for completed changes

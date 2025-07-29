# Chunking Improvements Reference

**Issue**: [GitHub #5073](https://github.com/mastra-ai/mastra/issues/5073) - Improve chunking

## Problems Identified

### 1. Type System Confusion

- `minSize`/`maxSize` parameters available for all strategies but only work with JSON
- Character/recursive strategies ignore these parameters, only use `size`
- No compile-time validation of strategy-specific parameters

### 2. Sentence Structure Issues

- Current character chunking breaks sentences mid-flow
- No way to preserve sentence boundaries
- User example produces chunks like: `"...mood"` and `". The setting..."`

## Solution: New `sentence` Strategy + Type Improvements

### Enhanced `sentence` Strategy (Hybrid Implementation)

**Purpose**: Sentence-aware chunking that preserves sentence structure with sophisticated boundary detection

**Key Features**:

- ✅ **Sophisticated sentence detection** with abbreviation handling (Dr., U.S.A., a.m., etc.)
- ✅ **Integrated overlap processing** for efficiency
- ✅ **Granular fallback control** (words + characters)
- ✅ **Perfect sentence preservation**
- ✅ **Extends TextTransformer** for consistency

**Parameters**:

```typescript
type SentenceChunkOptions = {
  minSize?: number; // Min chunk size (default: 50)
  maxSize: number; // Max chunk size (required)
  targetSize?: number; // Preferred size (default: maxSize * 0.8)
  overlap?: number; // Overlap in characters
  sentenceEnders?: string[]; // Custom endings (default: ['.', '!', '?'])
  preserveWhitespace?: boolean; // Keep spacing
  fallbackToWords?: boolean; // Split long sentences on words
  fallbackToCharacters?: boolean; // Split long words on characters (new!)
  keepSeparator?: boolean; // Include sentence separators
};
```

**Logic**:

1. **Smart sentence detection** using regex + abbreviation heuristics
2. **Abbreviation handling** for common patterns (titles, countries, times, numbers)
3. **Integrated overlap** during chunking for efficiency
4. **Two-level fallback**: words → characters with granular control
5. **Never break mid-sentence** unless absolutely necessary

### Type System Overhaul

- **Complete replacement** of generic types with strategy-specific option types
- **Removed legacy types** (`ChunkOptions`, `LegacyChunkParams`) for cleaner API
- Compile-time AND runtime validation of parameters per strategy
- All transformers internally use their specific chunk option types

## Implementation Plan

### Files to Modify

1. `packages/rag/src/document/types.ts` - Add new types
2. `packages/rag/src/document/document.ts` - Add sentence chunking method
3. `packages/rag/src/document/transformers/sentence.ts` - New transformer (create)
4. `packages/rag/src/document/document.test.ts` - Add tests

### User Experience After Implementation

```typescript
// ✅ NEW: Sentence strategy with perfect sentence preservation
const chunked = await doc.chunk({
  strategy: 'sentence',
  minSize: 50,
  maxSize: 350, // Tuned for optimal chunking
  targetSize: 250, // Controls chunk grouping
  sentenceEnders: ['.'],
  keepSeparator: true,
});

// ✅ EXISTING: Character strategy (now with proper types)
const chunked = await doc.chunk({
  strategy: 'character',
  size: 450, // Correct parameter for character strategy
  separator: '.',
});

// ❌ PREVENTED: TypeScript catches invalid parameter combinations
const chunked = await doc.chunk({
  strategy: 'character',
  maxSize: 450, // TS Error: not valid for character strategy
  minSize: 50, // TS Error: not valid for character strategy
});
```

### Backward Compatibility

- ✅ **User-facing API**: `doc.chunk()` interface remains unchanged for existing strategies
- ✅ **Strategy names**: All existing strategy names and core parameters work identically
- ❌ **BREAKING**: Stricter TypeScript validation may catch previously ignored invalid parameters
- ❌ **BREAKING**: Direct transformer class instantiation requires new constructor signatures
- ❌ **BREAKING**: Reworked legacy `ChunkOptions` and `ChunkParams` types
- ✅ **New strategy**: `sentence` added strategy is opt-in

## Test Case (From Issue)

**Input**: Long paragraph about concert scene (810 chars)
**Original Character Strategy**: 6 chunks with broken sentences
**Our Sentence Strategy**: 3 chunks with perfect sentence preservation
**Result**: ✅ EXACT match to user's expected output

**Test File**: `packages/rag/5073-example-test.mjs` demonstrates all three approaches

## Implementation Status ✅

**COMPLETED:**

- ✅ **Hybrid sentence strategy** combining best-of-both-worlds architecture
- ✅ **Enhanced sentence detection** with sophisticated abbreviation handling
- ✅ **Clean strategy-specific type system** - Legacy types removed for better API
- ✅ **More efficient overlap processing** - Integrated during chunking (not post-processing)
- ✅ **Granular fallback control** - Users can control word + character fallbacks independently
- ✅ **TextTransformer inheritance** - Consistent architecture with other transformers
- ✅ TypeScript compile-time validation prevents invalid parameter combinations
- ✅ Comprehensive test suite with 8 test cases covering all features
- ✅ Full build and TypeScript compilation success
- ✅ **SYSTEM CONSISTENCY** - All transformers now use their strategy-specific types:
  - `CharacterTransformer` → `CharacterChunkOptions`
  - `RecursiveCharacterTransformer` → `RecursiveChunkOptions`
  - `TokenTransformer` → `TokenChunkOptions`
  - `RecursiveJsonTransformer` → `JsonChunkOptions`
  - `HTMLHeaderTransformer` & `HTMLSectionTransformer` → `HTMLChunkOptions`
  - `MarkdownTransformer`/`LatexTransformer` → Consistent base patterns
  - `SentenceTransformer` → `SentenceChunkOptions`

**Enhanced Features Over Original Implementation:**

- 🚀 **Sophisticated boundary detection**: Handles "Dr. Smith", "U.S.A.", "3.14", "a.m." correctly
- 🚀 **Better architecture**: Extends TextTransformer for consistency + inheritance benefits
- 🚀 **More efficient**: Integrated overlap processing (single-pass vs two-pass)
- 🚀 **Granular control**: `fallbackToCharacters` parameter for fine-tuned behavior
- 🚀 **Production-ready**: Handles edge cases, oversized content, warnings for disabled fallbacks

**Key Features Implemented:**

- **Perfect Sentence Preservation**: Never breaks mid-sentence unless absolutely necessary
- **Smart Abbreviation Handling**: Detects titles, countries, times, decimals, initials
- **Size Constraints**: Respects minSize, maxSize, and targetSize parameters
- **Integrated Overlap**: Efficient sentence-level overlap during chunking
- **Two-level Fallback**: Words → characters with independent control
- **Metadata Preservation**: Maintains metadata across all chunks

**Verification:**

- ✅ **Perfect User Solution**: Tuned sentence strategy produces EXACT 3-chunk output user requested
- ✅ **Enhanced Sentence Detection**: Successfully handles abbreviations, titles, and edge cases
- ✅ **Complete Test Coverage**: 8/8 sentence tests pass + comprehensive validation test file
- ✅ **Hybrid Architecture Success**: Best features from both implementations combined seamlessly
- ✅ **Clean Type System**: Legacy types fully removed, strategy-specific enforcement everywhere
- ✅ **Full System Consistency**: All 8 transformers now use their specific chunk option types
- ✅ **Production Performance**: More efficient single-pass overlap processing
- ✅ **Controlled Breaking Changes**: User-facing API preserved, internal consistency improved
- ✅ **Build Success**: TypeScript compilation with strict type enforcement
- ✅ **Runtime Validation**: All strategies verified working with enhanced implementation

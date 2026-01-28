# Schema-Compat Improvements Roadmap

This document tracks potential fixes and improvements for the `@mastra/schema-compat` package.

## Recently Completed

### Migrated to AI SDK v6
- Replaced `@internal/ai-sdk-v4` and `@internal/ai-sdk-v5` with `@internal/ai-v6`
- Updated `MockLanguageModelV1` → `MockLanguageModelV3` in all test files

### Type Guards Now Use `instanceof`
- Updated `schema-compatibility-v3.ts` and `schema-compatibility-v4.ts` to use `instanceof` checks
- Vitest workspace aliasing ensures v3 tests use the same Zod package as source files
- Cleaner code without `_def.typeName` or `_zod.def.type` string comparisons in type guards

### Removed Unused Interface
- Deleted `schema-compatibility.interface.ts` (ISchemaCompatLayer was never used)

### Vitest Configuration
- Migrated from deprecated `test.workspace` to Vitest 4.x `test.projects` syntax
- Proper v3/v4 test separation with module aliasing

---

## Critical Issues

### 1. Type Safety - @ts-expect-error Suppressions (33 instances)

**Location**: `schema-compatibility.ts`, `schema-compatibility-v4.ts`, `utils.ts`

**Problem**: Heavy reliance on `@ts-expect-error` to suppress TypeScript errors when accessing Zod v4 internal structures (`_zod.def`).

**Root Cause**: Zod v4's internal types are not fully exported, and the codebase accesses nested properties like `_zod.def.type`, `_zod.def.innerType`, `_zod.def.check` without proper type definitions.

**Solution**:
```typescript
// Create internal type definitions for Zod v4 structures
interface ZodV4Def {
  type: string;
  innerType?: ZodType;
  checks?: ZodV4Check[];
  // ... other properties
}

interface ZodV4Check {
  _zod: {
    def: {
      check: string;
      minimum?: number;
      maximum?: number;
      // ...
    };
  };
}
```

**Priority**: High
**Effort**: Medium

---

### 2. `any` Type Proliferation (~150+ instances)

**Problem**: Widespread use of `any` types defeats TypeScript's type safety, especially in:
- Generic Zod type parameters: `ZodObject<any, any>`
- Type assertions: `(value as any)._zod?.def`
- Function return types

**Impact**: Type errors are silently ignored, bugs can slip through, IDE autocomplete is degraded.

**Solution**:
- Create proper generic type constraints
- Use `unknown` with type guards instead of `any`
- Add branded types for internal structures

**Priority**: High
**Effort**: High

---

### 3. Skipped Tests (3 tests)

**Location**: `schema-compatibility-v4.test.ts` lines 501-529

**Skipped Tests**:
- `should handle optional object schemas`
- `should handle optional array schemas`
- `should handle optional scalar schemas`

**Root Cause**: `z.toJSONSchema()` in Zod v4 doesn't preserve optionality markers as expected.

**Solution**: Investigate Zod v4's JSON Schema output for optional types and implement custom handling if needed.

**Priority**: Medium
**Effort**: Medium

---

## Medium Priority Improvements

### 4. Hardcoded Model Detection

**Locations**:
- `provider-compats/openai.ts:102` - `modelId.includes('gpt-4o-mini')`
- `provider-compats/anthropic.ts:48` - `modelId.includes('claude-3.5-haiku')`
- `provider-compats/openai-reasoning.ts:22-24` - `modelId.includes('o1')`, `o3`, `o4`

**Problems**:
- Brittle string matching
- Case sensitivity not handled
- New models require code changes
- No versioning strategy

**Solution**: Create a configuration-driven model registry:
```typescript
interface ModelCapabilities {
  supportsStructuredOutputs: boolean;
  jsonSchemaTarget: 'jsonSchema7' | 'openApi3';
  unsupportedStringChecks?: StringCheckType[];
  // ...
}

const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  'gpt-4o': { supportsStructuredOutputs: true, jsonSchemaTarget: 'jsonSchema7' },
  'gpt-4o-mini': { supportsStructuredOutputs: true, jsonSchemaTarget: 'jsonSchema7', unsupportedStringChecks: ['emoji', 'regex'] },
  // ...
};
```

**Priority**: Medium
**Effort**: Medium

---

### 5. Duplicate Constants Across V3/V4 Files

**Problem**: `ALL_STRING_CHECKS`, `ALL_NUMBER_CHECKS`, etc. are defined in both:
- `schema-compatibility-v3.ts`
- `schema-compatibility-v4.ts`
- `zodTypes.ts`

**Solution**: Extract shared constants to `zodTypes.ts` with version-specific overrides:
```typescript
// zodTypes.ts
export const BASE_STRING_CHECKS = ['email', 'url', 'uuid', 'cuid'] as const;
export const V3_STRING_CHECKS = [...BASE_STRING_CHECKS, 'min', 'max'] as const;
export const V4_STRING_CHECKS = [...BASE_STRING_CHECKS, 'min_length', 'max_length'] as const;
```

**Priority**: Medium
**Effort**: Low

---

### 6. Consolidate JSON Schema Patching

**Problem**: JSON Schema patching logic is scattered across:
- `zod-to-json.ts`: `patchRecordSchemas()`, `fixAnyOfNullable()`
- `provider-compats/openai.ts`: `fixAdditionalProperties()`
- `standard-schema/adapters/*.ts`: Similar patching

**Solution**: Create a single `JsonSchemaNormalizer` class:
```typescript
class JsonSchemaNormalizer {
  static normalize(schema: JSONSchema7, options?: NormalizationOptions): JSONSchema7 {
    return pipe(
      this.patchRecordSchemas,
      this.fixAnyOfNullable,
      this.fixAdditionalProperties,
    )(schema);
  }
}
```

**Priority**: Medium
**Effort**: Medium

---

### 7. Inconsistent Type Guard Patterns

**Problem**: Three different approaches for type guards:
1. `zodTypes.ts` - Factory functions with generic type parameter
2. `schema-compatibility-v3.ts` - `instanceof` checks
3. `schema-compatibility-v4.ts` - Internal `_zod.def.type` checks

**Solution**: Standardize on one pattern per Zod version:
- V3: Use `instanceof` (works with aliasing)
- V4: Use `_zod.def.type` checks (required for internal types)

Document the rationale in code comments.

**Priority**: Medium
**Effort**: Low

---

## Low Priority Improvements

### 8. Error Handling Improvements

**Current Issues**:
- Generic error messages without context
- No error codes or custom error types
- Manual stack trace concatenation
- `console.error()` in production code

**Solution**:
```typescript
class SchemaCompatError extends Error {
  constructor(
    message: string,
    public code: SchemaCompatErrorCode,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SchemaCompatError';
  }
}

enum SchemaCompatErrorCode {
  UNSUPPORTED_TYPE = 'UNSUPPORTED_TYPE',
  CONVERSION_FAILED = 'CONVERSION_FAILED',
  INVALID_UNION = 'INVALID_UNION',
}
```

**Priority**: Low
**Effort**: Medium

---

### 9. Missing Provider Test Coverage

**Problem**: Some providers lack dedicated tests:
- DeepSeek: 0 dedicated tests
- Meta: 0 dedicated tests
- Google: Minimal coverage

**Solution**: Add test files for each provider with:
- Model detection tests
- Schema transformation tests
- Edge case handling

**Priority**: Low
**Effort**: Medium

---

### 10. Documentation Gaps

**Missing Documentation**:
1. Internal architecture design doc (v3/v4 split rationale)
2. Model detection strategy explanation
3. Standard Schema integration purpose
4. Error handling guide for consumers
5. Type system limitations acknowledgment

**Priority**: Low
**Effort**: Medium

---

### 11. Lazy Loading Error Handling

**Location**: `zod-to-json.ts`

**Problem**:
```typescript
function getZodV4(): typeof import('zod/v4').z {
  if (!_zv4Cache) {
    _zv4Cache = require('zod/v4').z;  // Could throw if not installed
  }
  return _zv4Cache!;
}
```

**Solution**: Add try-catch with helpful error message:
```typescript
function getZodV4(): typeof import('zod/v4').z {
  if (!_zv4Cache) {
    try {
      _zv4Cache = require('zod/v4').z;
    } catch {
      throw new Error(
        'Zod v4 is required for this operation. Install with: pnpm add zod@^4'
      );
    }
  }
  return _zv4Cache;
}
```

**Priority**: Low
**Effort**: Low

---

## Technical Debt Summary

| Category | Count | Severity | Effort |
|----------|-------|----------|--------|
| @ts-expect-error | 33 | High | Medium |
| `any` types | ~150 | High | High |
| Skipped tests | 3 | Medium | Medium |
| Hardcoded values | 8+ | Medium | Medium |
| Duplicate code | 3 groups | Low | Low |
| Missing tests | 2 providers | Low | Medium |
| Documentation | 5 areas | Low | Medium |

---

## Recommended Priority Order

1. **Phase 1** (Quick Wins):
   - Fix lazy loading error handling
   - Consolidate duplicate constants
   - Add missing provider tests

2. **Phase 2** (Type Safety):
   - Create Zod v4 internal type definitions
   - Reduce @ts-expect-error suppressions
   - Standardize type guard patterns

3. **Phase 3** (Architecture):
   - Implement model capabilities registry
   - Consolidate JSON Schema normalizer
   - Unskip and fix optional schema tests

4. **Phase 4** (Polish):
   - Improve error handling with custom errors
   - Reduce `any` type usage
   - Add comprehensive documentation

---

## Notes

- The vitest workspace configuration (`vitest.config.ts`) uses Vitest 4.x `test.projects` for v3/v4 test separation with aliasing
- The `zod-from-json-schema` packages have their own Zod dependencies, so `instanceof` checks may fail across package boundaries
- Standard Schema support is new and may need additional stabilization

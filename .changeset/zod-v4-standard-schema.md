---
"@mastra/core": minor
"@mastra/schema-compat": minor
---

Add Zod v4 and Standard Schema support

## Zod v4 Breaking Changes
- Fix all `z.record()` calls to use 2-argument form (key + value schema) as required by Zod v4
- Update `ZodError.errors` to `ZodError.issues` (Zod v4 API change)
- Update `@ai-sdk/provider` versions for Zod v4 compatibility

## Standard Schema Integration
- Add `packages/core/src/schema/` module that re-exports from `@mastra/schema-compat`
- Migrate codebase to use `PublicSchema` type for schema parameters
- Use `toStandardSchema()` for normalizing schemas across Zod v3, Zod v4, AI SDK Schema, and JSON Schema
- Use `standardSchemaToJSONSchema()` for JSON Schema conversion

## Schema Compatibility (@mastra/schema-compat)
- Add new adapter exports: `@mastra/schema-compat/adapters/ai-sdk`, `@mastra/schema-compat/adapters/zod-v3`, `@mastra/schema-compat/adapters/json-schema`
- Enhance test coverage with separate v3 and v4 test suites
- Improve zod-to-json conversion with `unrepresentable: 'any'` support

## TypeScript Fixes
- Resolve deep instantiation errors in client-js and model.ts
- Add proper type assertions where Zod v4 inference differs

**BREAKING CHANGE**: Minimum Zod version is now `^3.25.0` for v3 compatibility or `^4.0.0` for v4

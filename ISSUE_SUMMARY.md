# Issue #8494 - AWS Bedrock MCP Schema Bug - Investigation Summary

## Problem

AWS Bedrock agents fail with MCP tools when building on Node.js v24+ but work on Node v20-v22.

**Error**: `The value at toolConfig.tools.0.toolSpec.inputSchema.json.type must be one of the following: object.`

**Affected**: Building on Node.js v24+  
**Working**: Building on Node.js v20, v21, v22

---

## Root Cause

**When `mastra build` runs on Node v24, the bundler corrupts Zod schemas during bundling.**

### Critical Finding

The Node version used to **BUILD** the project matters, NOT the runtime version:

- ✅ Build with Node v22, run on Node v24 → **WORKS**
- ❌ Build with Node v24, run on Node v24 → **FAILS**
- ❌ Build with Node v24, run on Node v22 → **FAILS**

This proves it's a **build-time bundling issue**, not a runtime issue.

---

## What Happens During Bundling

When Zod is **bundled** (not external) on Node v24, the bundler transforms it incorrectly:

### Unbundled Zod (Correct - Direct Import)

```
Total keys: 29
First 5 keys: spa, _def, parse, safeParse, parseAsync
~standard position: 25

_def structure:
  _def.typeName: ZodObject ✅
  _def.type: undefined
  _def keys: shape, unknownKeys, catchall, typeName
```

### Bundled on Node v22 (Correct)

```
Total keys: 29
First 5 keys: spa, _def, parse, safeParse, parseAsync
~standard position: 25

_def structure:
  _def.typeName: ZodObject ✅
  _def.type: undefined
  _def keys: shape, unknownKeys, catchall, typeName

Result: type: object, has properties: true ✅
```

### Bundled on Node v24 (CORRUPTED)

```
Total keys: 53 (24 EXTRA!)
First 5 keys: ~standard, def, type, check, clone
~standard position: 0 (MOVED TO FIRST!)

_def structure:
  _def.typeName: undefined ❌
  _def.type: object (WRONG PROPERTY!)
  _def keys: type, shape, catchall (MISSING unknownKeys, typeName!)

Result: type: undefined, has properties: false ❌
Empty schema: { "$schema": "..." }
```

### Complete Key Comparison

#### Node v22 Bundled (All 29 keys)

```
spa, _def, parse, safeParse, parseAsync, safeParseAsync, refine, refinement,
superRefine, optional, nullable, nullish, array, promise, or, and, transform,
brand, default, catch, describe, pipe, readonly, isNullable, isOptional,
~standard, _cached, nonstrict, augment
```

#### Node v24 Bundled (All 53 keys)

```
~standard, def, type, check, clone, brand, register, parse, safeParse,
parseAsync, safeParseAsync, spa, encode, decode, encodeAsync, decodeAsync,
safeEncode, safeDecode, safeEncodeAsync, safeDecodeAsync, refine, superRefine,
overwrite, optional, nullable, nullish, nonoptional, array, or, and, transform,
default, prefault, catch, pipe, readonly, describe, meta, isOptional,
isNullable, keyof, catchall, passthrough, loose, strict, strip, extend,
safeExtend, merge, pick, omit, partial, required
```

#### Keys Only in Node v24 (24 extra)

```
def, type, check, clone, register, encode, decode, encodeAsync, decodeAsync,
safeEncode, safeDecode, safeEncodeAsync, safeDecodeAsync, overwrite,
nonoptional, prefault, meta, keyof, catchall, passthrough, loose, strict,
strip, safeExtend
```

**Note**: Some of these are valid Zod methods (keyof, catchall, passthrough, strict, strip, extend, merge, pick, omit, partial, required), but many are completely fake (encode, decode, safeEncode, etc.)

### The Corruption

When bundled on Node v24, the bundler:

1. **Adds 24 extra properties** - some valid Zod methods exposed, many completely fake
2. **Reorders keys** - moves `~standard` from position 25 to position 0
3. **Renames internal properties** - `_def.typeName` becomes `_def.type`
4. **Changes values** - `'ZodObject'` becomes `'object'`
5. **Removes properties** - `_def.unknownKeys` disappears

#### \_def Internal Comparison

```
Node v22: shape, unknownKeys, catchall, typeName
Node v24: type, shape, catchall

Missing in v24: unknownKeys, typeName
Added in v24: type (wrong property name!)
```

### Why zod-to-json-schema Fails

The `zod-to-json-schema@3.24.6` library expects `_def.typeName` to exist:

- It uses this in the `selectParser()` function to determine schema type
- When `_def.typeName` is undefined, it can't identify the schema
- Returns empty schema: `{ "$schema": "..." }`

---

## What We Ruled Out

1. ❌ Double-wrapping of schemas
2. ❌ `zod-to-json-schema` library bug on Node v24 (works fine with unbundled Zod)
3. ❌ `$refStrategy` or `target` configuration issue (all combinations work on v24)
4. ❌ Runtime Node version incompatibility
5. ❌ esbuild `target` setting (changing from `node20` to `node24` doesn't fix it)

### What We Confirmed

1. ✅ `zod-to-json-schema` works perfectly on Node v24 when Zod is NOT bundled
2. ✅ All `$refStrategy` and `target` combinations work on Node v24
3. ✅ The issue ONLY happens when `mastra build` bundles Zod into the output
4. ✅ Changing esbuild `target` doesn't help
5. ✅ The Node version running the BUILD matters, not the runtime

---

## The Bundler Stack

```
mastra build
  ↓
BuildBundler (packages/cli/src/commands/build/BuildBundler.ts)
  ↓
Bundler (packages/deployer/src/bundler/index.ts)
  ↓
Rollup + rollup-plugin-esbuild (packages/deployer/src/build/bundler.ts)
  ↓
esbuild (transforms TypeScript/JavaScript)
```

When running on Node v24, esbuild's transformation behavior changes, corrupting Zod's internal structure.

### Key Bundler Files

- `packages/deployer/src/build/bundler.ts` - Rollup configuration, external dependencies
- `packages/deployer/src/build/analyze.ts` - Determines what gets bundled vs external
- `packages/deployer/src/build/plugins/esbuild.ts` - esbuild wrapper (target: 'node20')

---

## Temporary Workaround

### Making Zod External

One approach that fixes the issue: prevent Zod from being bundled.

**File**: `packages/deployer/src/build/analyze.ts` (around line 59)

```typescript
// Always keep Zod external to avoid bundling corruption on Node v24+
// When Zod is bundled on Node v24, the bundler transforms it in a way that
// corrupts the internal _def.typeName property, breaking zod-to-json-schema.
result.externalDependencies.add('zod');
```

**Testing**: After this change, building on Node v24 works correctly.

**Tradeoffs**:

- ✅ Fixes Node v24 build issue
- ✅ Smaller bundle size
- ✅ Works on all Node versions
- ❌ Zod becomes a runtime dependency (must be in deployed `package.json`)
- ❌ Users need to ensure Zod is installed in production

**Note**: This is a temporary workaround. There may be better solutions.

---

## Debug Logging Added

For investigation, debug logging was added to:

- `packages/schema-compat/src/zod-to-json.ts` - Schema structure logging
- `packages/core/src/tools/tool-builder/builder.ts` - Tool processing logging

These can be removed once a permanent fix is implemented.

---

## Key Learnings

1. **Bundler behavior varies by Node version** - Not just runtime, but build-time transformation
2. **esbuild's `target` setting doesn't control transformation behavior** - Only output features
3. **Symbols (`~standard`) cause issues** - Node v24 handles Symbol properties differently during bundling
4. **Testing methodology matters**: Must test with clean node_modules on each Node version

---

## Test Commands

### Manual Testing Flow

```bash
# 1. Clean
cd /path/to/test-project
rm -rf .mastra node_modules pnpm-lock.yaml

# 2. Switch Node version
nvm use 24

# 3. Install & Build
pnpm install
pnpm build

# 4. Check if Zod is external (if fix applied)
cat .mastra/output/package.json | grep zod
# Should see zod in dependencies if external

# 5. Start & Test
pnpm start &
sleep 10
curl -X POST http://localhost:4111/api/agents/awsAgent/generate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}]}'
```

### Testing Different Node Versions

```bash
# Build with v22, run with v24
nvm use 22 && pnpm build
nvm use 24 && pnpm start

# Build with v24, run with v24
nvm use 24 && pnpm build && pnpm start
```

---

## Possible Solutions to Explore

1. **Keep Zod external** (current workaround) - Prevents bundling corruption
2. **Fix bundler configuration** - Adjust Rollup/esbuild settings to preserve Zod structure
3. **Custom Zod-to-JSON converter** - Bypass zod-to-json-schema entirely
4. **Pin build to Node v22** - Document that builds must use v22 LTS
5. **Investigate esbuild/rollup** - May be worth reporting upstream

---

## Files Modified (For Investigation)

### Debug Logging

- `packages/schema-compat/src/zod-to-json.ts` - Added comprehensive logging
- `packages/core/src/tools/tool-builder/builder.ts` - Added tool logging

### Workaround (Optional)

- `packages/deployer/src/build/analyze.ts` - Can add Zod to external dependencies

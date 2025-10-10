# Issue #8494 - AWS Bedrock MCP Schema Bug - Investigation Summary

## Problem

AWS Bedrock agents fail with MCP tools when building with **pnpm** on Node.js v24.

**Error**: `The value at toolConfig.tools.0.toolSpec.inputSchema.json.type must be one of the following: object.`

**Affected**: Building with **pnpm** on Node.js v24  
**Working**: Building with **npm** on Node.js v24, or **pnpm** on Node v20-v22

---

## Root Cause

**When `mastra build` runs with pnpm on Node v24, and MCP tools are enabled, the bundler corrupts Zod schemas during bundling.**

### Critical Finding

This is a **pnpm-specific issue** on Node v24 when MCP tools are used:

- ✅ **pnpm + Node v24 + NO MCP** → **WORKS**
- ❌ **pnpm + Node v24 + WITH MCP** → **FAILS** (Zod schemas corrupted)
- ✅ **npm + Node v24 + WITH MCP** → **WORKS**
- ✅ **pnpm + Node v22 + WITH MCP** → **WORKS**

### Test Matrix

| Package Manager | Node | Zod | MCP Tools | Result                                |
| --------------- | ---- | --- | --------- | ------------------------------------- |
| pnpm            | v24  | v3  | ✅ YES    | ❌ FAILS (53 keys, schema corruption) |
| pnpm            | v24  | v4  | ✅ YES    | ❌ FAILS (53 keys, schema corruption) |
| pnpm            | v24  | v3  | ❌ NO     | ✅ WORKS                              |
| pnpm            | v24  | v4  | ❌ NO     | ✅ WORKS                              |
| npm             | v24  | v3  | ✅ YES    | ✅ WORKS (29 keys, correct)           |
| npm             | v24  | v3  | ❌ NO     | ✅ WORKS                              |

**Key Insights:**

- Zod version (v3 or v4) does not affect the issue
- Local workspace packages vs published packages does not affect the issue
- The issue ONLY occurs with pnpm + Node v24 + MCP tools enabled

---

## What Happens During Bundling

When pnpm builds on Node v24 with MCP tools enabled, Zod schemas are corrupted:

### Correct Schema (npm or pnpm without MCP)

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

### Corrupted Schema (pnpm + Node v24 + MCP)

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

#### Correct (29 keys)

```
spa, _def, parse, safeParse, parseAsync, safeParseAsync, refine, refinement,
superRefine, optional, nullable, nullish, array, promise, or, and, transform,
brand, default, catch, describe, pipe, readonly, isNullable, isOptional,
~standard, _cached, nonstrict, augment
```

#### Corrupted (53 keys)

```
~standard, def, type, check, clone, brand, register, parse, safeParse,
parseAsync, safeParseAsync, spa, encode, decode, encodeAsync, decodeAsync,
safeEncode, safeDecode, safeEncodeAsync, safeDecodeAsync, refine, superRefine,
overwrite, optional, nullable, nullish, nonoptional, array, or, and, transform,
default, prefault, catch, pipe, readonly, describe, meta, isOptional,
isNullable, keyof, catchall, passthrough, loose, strict, strip, extend,
safeExtend, merge, pick, omit, partial, required
```

#### Keys Only in Corrupted Version (24 extra)

```
def, type, check, clone, register, encode, decode, encodeAsync, decodeAsync,
safeEncode, safeDecode, safeEncodeAsync, safeDecodeAsync, overwrite,
nonoptional, prefault, meta, keyof, catchall, passthrough, loose, strict,
strip, safeExtend
```

### The Corruption

When pnpm builds with MCP tools on Node v24, the bundler:

1. **Adds 24 extra properties** - some valid Zod methods exposed, many completely fake
2. **Reorders keys** - moves `~standard` from position 25 to position 0
3. **Renames internal properties** - `_def.typeName` becomes `_def.type`
4. **Changes values** - `'ZodObject'` becomes `'object'`
5. **Removes properties** - `_def.unknownKeys` disappears

#### \_def Internal Comparison

```
Correct: shape, unknownKeys, catchall, typeName
Corrupted: type, shape, catchall

Missing in corrupted: unknownKeys, typeName
Added in corrupted: type (wrong property name!)
```

### Why zod-to-json-schema Fails

The `zod-to-json-schema@3.24.6` library expects `_def.typeName` to exist:

- It uses this in the `selectParser()` function to determine schema type
- When `_def.typeName` is undefined, it can't identify the schema
- Returns empty schema: `{ "$schema": "..." }`
- AWS Bedrock rejects the schema because `type` is missing

---

## What We Ruled Out

1. ❌ Zod version (tested v3 and v4 - both fail with pnpm + Node v24 + MCP)
2. ❌ Local workspace packages vs published packages (both fail)
3. ❌ `zod-to-json-schema` library bug (works fine with npm)
4. ❌ `$refStrategy` or `target` configuration issue
5. ❌ esbuild `target` setting
6. ❌ General Node v24 incompatibility (npm works fine)

### What We Confirmed

1. ✅ The issue is **pnpm-specific** on Node v24
2. ✅ npm works correctly on Node v24 with MCP tools
3. ✅ The issue ONLY manifests when **MCP tools are enabled**
4. ✅ Without MCP tools, pnpm + Node v24 works fine
5. ✅ The corruption happens during the **build/bundle process**

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

When pnpm runs the build on Node v24 with MCP tools, the bundler corrupts Zod's internal structure.

### Key Bundler Files

- `packages/deployer/src/build/bundler.ts` - Rollup configuration, external dependencies
- `packages/deployer/src/build/analyze.ts` - Determines what gets bundled vs external
- `packages/deployer/src/build/plugins/esbuild.ts` - esbuild wrapper (target: 'node20')

---

## Workaround: Use npm Instead of pnpm

**Immediate Solution**: When building on Node v24 with MCP tools, use **npm** instead of **pnpm**.

```bash
# Instead of:
pnpm install
pnpm build

# Use:
npm install
npm run build
```

This completely avoids the issue while maintaining full functionality.

---

## Alternative Workaround: Making Zod External

If you must use pnpm, you can prevent Zod from being bundled.

**File**: `packages/deployer/src/build/analyze.ts` (around line 59)

```typescript
// Always keep Zod external to avoid bundling corruption on Node v24+ with pnpm
// When Zod is bundled with pnpm on Node v24, the bundler transforms it in a way that
// corrupts the internal _def.typeName property, breaking zod-to-json-schema.
result.externalDependencies.add('zod');
```

**Tradeoffs**:

- ✅ Fixes pnpm + Node v24 build issue
- ✅ Smaller bundle size
- ✅ Works on all Node versions and package managers
- ❌ Zod becomes a runtime dependency (must be in deployed `package.json`)
- ❌ Users need to ensure Zod is installed in production

---

## Debug Logging Added

For investigation, debug logging was added to:

- `packages/schema-compat/src/zod-to-json.ts` - Schema structure logging
- `packages/core/src/tools/tool-builder/builder.ts` - Tool processing logging

These can be removed once a permanent fix is implemented.

---

## Test Commands

### Manual Testing Flow (pnpm)

```bash
# 1. Clean
cd /path/to/test-project
rm -rf .mastra node_modules pnpm-lock.yaml

# 2. Switch Node version
nvm use 24

# 3. Install & Build with pnpm
pnpm install
pnpm build

# 4. Start & Test
pnpm start &
sleep 10
curl -X POST http://localhost:4111/api/agents/awsAgent/generate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}]}'
```

### Manual Testing Flow (npm - working)

```bash
# 1. Clean
cd /path/to/test-project
rm -rf .mastra node_modules package-lock.json

# 2. Switch Node version
nvm use 24

# 3. Install & Build with npm
npm install
npm run build

# 4. Start & Test
npm start &
sleep 10
curl -X POST http://localhost:4111/api/agents/awsAgent/generate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}]}'
```

---

## Possible Solutions

1. **Use npm instead of pnpm** (recommended immediate fix)
2. **Keep Zod external** (workaround if pnpm is required) - Prevents bundling corruption
3. **Pin builds to Node v22** - Document that pnpm builds must use v22 LTS
4. **Investigate pnpm bundling behavior** - May be worth reporting upstream to pnpm
5. **Custom Zod-to-JSON converter** - Bypass zod-to-json-schema entirely
6. **Fix bundler configuration** - Adjust Rollup/esbuild settings to preserve Zod structure

---

## Files Modified (For Investigation)

### Debug Logging

- `packages/schema-compat/src/zod-to-json.ts` - Added comprehensive logging
- `packages/core/src/tools/tool-builder/builder.ts` - Added tool logging

### Workaround (Optional)

- `packages/deployer/src/build/analyze.ts` - Can add Zod to external dependencies

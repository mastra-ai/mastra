# Migration Guide

Guide for upgrading Mastra versions using official documentation and current API verification.

## Migration strategy

For version upgrades, follow this process:

### 1. Check official migration docs

**Always start with the official migration documentation:** `https://mastra.ai/llms.txt`

Look for the **Migrations** or **Guides** section, which will have:

- Breaking changes for each version
- Automated migration tools
- Step-by-step upgrade instructions

**Example sections to look for:**

- `/guides/migrations/upgrade-to-v1/`
- `/guides/migrations/upgrade-to-v2/`
- Breaking changes lists

### 2. Use embedded docs for current APIs

After identifying breaking changes, verify the new APIs:

**Check your installed version:**

```bash
cat node_modules/@mastra/core/dist/docs/SOURCE_MAP.json | grep '"ApiName"'
cat node_modules/@mastra/core/dist/[path-from-source-map]
```

See [`embedded-docs.md`](embedded-docs.md) for detailed lookup instructions.

### 3. Use remote docs for latest info

If packages aren't updated yet, check what APIs will look like: `https://mastra.ai/reference/[topic]`

See [`remote-docs.md`](remote-docs.md) for detailed lookup instructions.

## Quick migration workflow

```bash
# 1. Check current version
npm list @mastra/core

# 2. Fetch migration guide from official docs
# Use WebFetch: https://mastra.ai/llms.txt
# Find relevant migration section

# 3. Update dependencies
npm install @mastra/core@latest @mastra/memory@latest @mastra/rag@latest mastra@latest

# 4. Run automated migration (if available)
npx @mastra/codemod@latest v1  # or whatever version

# 5. Check embedded docs for new APIs
cat node_modules/@mastra/core/dist/docs/SOURCE_MAP.json

# 6. Fix breaking changes using embedded docs lookup
# See embedded-docs.md for how to look up each API

# 7. Test
npm run dev
npm test
```

## Common migration patterns

### Finding what changed

**Check official migration docs:** `https://mastra.ai/guides/migrations/upgrade-to-v1/overview.md`

This will list:

- Breaking changes
- Deprecated APIs
- New features
- Migration tools

### Updating API usage

**For each breaking change:**

1. **Find the old API** in your code
2. **Look up the new API** using embedded docs:
   ```bash
   cat node_modules/@mastra/core/dist/docs/SOURCE_MAP.json | grep '"NewApi"'
   cat node_modules/@mastra/core/dist/[path]
   ```
3. **Update your code** based on the type signatures
4. **Test** the change

### Example: Tool execute signature change

**Official docs say:** "Tool execute signature changed"

**Look up current signature:**

```bash
cat node_modules/@mastra/core/dist/docs/SOURCE_MAP.json | grep '"createTool"'
cat node_modules/@mastra/core/dist/tools/tool.d.ts
```

**Update based on type definition:**

```typescript
// Old (from docs)
execute: async (input) => { ... }

// New (from embedded docs)
execute: async (inputData, context) => { ... }
```

## Pre-migration checklist

- [ ] Backup code (git commit)
- [ ] Check official migration docs: `https://mastra.ai/llms.txt`
- [ ] Note current version: `npm list @mastra/core`
- [ ] Read breaking changes list
- [ ] Tests are passing

## Post-migration checklist

- [ ] All dependencies updated together
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Tests pass: `npm test`
- [ ] Studio works: `npm run dev`
- [ ] No console warnings
- [ ] APIs verified against embedded docs

## Migration resources

| Resource                               | Use For                                       |
| -------------------------------------- | --------------------------------------------- |
| `https://mastra.ai/llms.txt`           | Finding migration guides and breaking changes |
| [`embedded-docs.md`](embedded-docs.md) | Looking up new API signatures after updating  |
| [`remote-docs.md`](remote-docs.md)     | Checking latest docs before updating          |
| [`common-errors.md`](common-errors.md) | Fixing migration errors                       |

## Version-specific notes

### General principles

1. **Always update all @mastra packages together**

   ```bash
   npm install @mastra/core@latest @mastra/memory@latest @mastra/rag@latest mastra@latest
   ```

2. **Check for automated migration tools**

   ```bash
   npx @mastra/codemod@latest [version]
   ```

3. **Verify Node.js version requirements**
   - Check official migration docs for minimum Node version

4. **Run database migrations if using storage**
   - Follow storage migration guide in official docs

## Getting help

1. **Check official migration docs**: `https://mastra.ai/llms.txt` → Migrations section
2. **Look up new APIs**: See [`embedded-docs.md`](embedded-docs.md)
3. **Check for errors**: See [`common-errors.md`](common-errors.md)
4. **Ask in Discord**: https://discord.gg/BTYqqHKUrf
5. **File issues**: https://github.com/mastra-ai/mastra/issues

## Key principles

1. **Official docs are source of truth** - Start with `https://mastra.ai/llms.txt`
2. **Verify with embedded docs** - Check installed version APIs
3. **Update incrementally** - Don't skip major versions
4. **Test thoroughly** - Run tests after each change
5. **Use automation** - Use codemods when available

# Embedded Docs Reference

Look up API signatures from embedded docs in `node_modules/@mastra/*/dist/docs/` - these match the installed version.

**Use this FIRST** when Mastra packages are installed locally. Embedded docs are always accurate for the installed version.

## Why use embedded docs

- **Version accuracy**: Embedded docs match the exact installed version
- **No network required**: All docs are local in `node_modules/`
- **Mastra evolves quickly**: APIs change rapidly, embedded docs stay in sync
- **TypeScript definitions**: Includes JSDoc, type signatures, and examples
- **Training data may be outdated**: Claude's knowledge cutoff may not reflect latest APIs

## Documentation structure

```
node_modules/@mastra/core/dist/docs/
├── SKILL.md # Package overview, exports
├── assets/
│   └── SOURCE_MAP.json # Export -> file mappings
└── references/ # Individual topic docs
```

## Lookup process

### 1. Check if packages are installed

```bash
ls node_modules/@mastra/
```

If you see packages like `core`, `memory`, `rag`, etc., proceed with embedded docs lookup.

### 2. Look through topic docs

Use `grep` to find relevant docs in `references/`:

```bash
grep -r "Agent" node_modules/@mastra/core/dist/docs/references
```

### Optional: Check source code for type definitions / additional details

Look at the `SOURCE_MAP.json` to find the file path for the export:

```bash
cat node_modules/@mastra/core/dist/docs/assets/SOURCE_MAP.json | grep '"Agent"'
```

Returns: `{ "Agent": { "types": "dist/agent/agent.d.ts", ... } }`

Read the type definition for exact constructor parameters, types, and JSDoc:

```bash
cat node_modules/@mastra/core/dist/agent/agent.d.ts
```

## Common packages

| Package          | Path                                     | Contains                                  |
| ---------------- | ---------------------------------------- | ----------------------------------------- |
| `@mastra/core`   | `node_modules/@mastra/core/dist/docs/`   | Agents, Workflows, Tools, Mastra instance  |
| `@mastra/memory` | `node_modules/@mastra/memory/dist/docs/` | Memory systems, conversation history      |
| `@mastra/rag`    | `node_modules/@mastra/rag/dist/docs/`    | RAG features, vector stores               |
| `@mastra/pg`     | `node_modules/@mastra/pg/dist/docs/`     | PostgreSQL storage                        |
| `@mastra/libsql` | `node_modules/@mastra/libsql/dist/docs/` | LibSQL/SQLite storage                     |

## Quick commands reference

```bash
# List installed @mastra packages
ls node_modules/@mastra/

# List available topic documentation
ls node_modules/@mastra/core/dist/docs/references/

# Find specific export in SOURCE_MAP
cat node_modules/@mastra/core/dist/docs/assets/SOURCE_MAP.json | grep '"ExportName"'

# Read type definition from path
cat node_modules/@mastra/core/dist/[path-from-source-map]

# View package overview
cat node_modules/@mastra/core/dist/docs/SKILL.md
```

## When embedded docs are not available

If packages aren't installed or `dist/docs/` doesn't exist:

1. **Recommend installation**: Suggest installing packages to access embedded docs
2. **Fall back to remote docs**: See `references/remote-docs.md`

## Best Practices

1. **Check topic docs** for conceptual understanding and patterns
2. **Search source code** if docs don't answer the question
3. **Verify imports** match what's exported in the type definitions

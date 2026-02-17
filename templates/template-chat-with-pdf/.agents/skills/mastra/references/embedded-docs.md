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
├── SKILL.md           # Package overview, exports
├── SOURCE_MAP.json    # Export→file mappings
└── [topics]/          # Feature docs (agents/, workflows/, etc.)
```

## Lookup process

### 1. Check if packages are installed

```bash
ls node_modules/@mastra/
```

If you see packages like `core`, `memory`, `rag`, etc., proceed with embedded docs lookup.

### 2. Find the export in SOURCE_MAP.json

```bash
cat node_modules/@mastra/core/dist/docs/SOURCE_MAP.json | grep '"Agent"'
```

Returns: `{ "Agent": { "types": "dist/agent/agent.d.ts", ... } }`

### 3. Read the type definition

```bash
cat node_modules/@mastra/core/dist/agent/agent.d.ts
```

This shows the exact TypeScript interface, constructor parameters, and JSDoc.

### 4. Check topic docs (optional)

```bash
cat node_modules/@mastra/core/dist/docs/agents/01-overview.md
```

Topic docs provide conceptual explanations and usage examples.

## Common packages

| Package          | Path                                     | Contains                                  |
| ---------------- | ---------------------------------------- | ----------------------------------------- |
| `@mastra/core`   | `node_modules/@mastra/core/dist/docs/`   | Agents, Workflows, Tools, Mastra instance |
| `@mastra/memory` | `node_modules/@mastra/memory/dist/docs/` | Memory systems, conversation history      |
| `@mastra/rag`    | `node_modules/@mastra/rag/dist/docs/`    | RAG features, vector stores               |
| `@mastra/pg`     | `node_modules/@mastra/pg/dist/docs/`     | PostgreSQL storage                        |
| `@mastra/libsql` | `node_modules/@mastra/libsql/dist/docs/` | LibSQL/SQLite storage                     |

## Quick commands reference

```bash
# List installed @mastra packages
ls node_modules/@mastra/

# Find specific export in SOURCE_MAP
cat node_modules/@mastra/core/dist/docs/SOURCE_MAP.json | grep '"ExportName"'

# Read type definition from path
cat node_modules/@mastra/core/dist/[path-from-source-map]

# List available topic documentation
ls node_modules/@mastra/core/dist/docs/

# View package overview
cat node_modules/@mastra/core/dist/docs/SKILL.md

# Search for specific functionality in source
grep -r "functionName" node_modules/@mastra/core/src/
```

## Example: Looking up agent constructor

**1. Find Agent in SOURCE_MAP:**

```bash
cat node_modules/@mastra/core/dist/docs/SOURCE_MAP.json | grep '"Agent"'
```

**2. Read the type definition:**

```bash
cat node_modules/@mastra/core/dist/agent/agent.d.ts
```

**3. Check topic docs for usage examples:**

```bash
cat node_modules/@mastra/core/dist/docs/agents/01-overview.md
```

## When embedded docs are not available

If packages aren't installed or `dist/docs/` doesn't exist:

1. **Recommend installation**: Suggest installing packages to access embedded docs
2. **Fall back to remote docs**: See `references/remote-docs.md`

## Best Practices

1. **Always check SOURCE_MAP.json first** to find the correct file path
2. **Read type definitions** for exact parameter names and types
3. **Check topic docs** for conceptual understanding and patterns
4. **Search source code** if docs don't answer the question
5. **Verify imports** match what's exported in the type definitions

# @mastra/core Documentation

> Embedded documentation for coding agents

## Quick Start

```bash
# Read the skill overview (for Claude Skills)
cat docs/SKILL.md

# Get the source map (machine-readable)
cat docs/SOURCE_MAP.json

# Read topic documentation
cat docs/<topic>/01-overview.md
```

## Structure

```
docs/
├── SKILL.md           # Claude Skills entry point
├── README.md          # This file
├── SOURCE_MAP.json    # Machine-readable export index
├── agents/
├── tools/
├── workflows/
├── streaming/
├── mastra/
├── server/
├── observability/
├── processors/
```

## Finding Code

The SOURCE_MAP.json maps every export to its:

- **types**: `.d.ts` file with API signatures and JSDoc
- **implementation**: `.js` chunk file with readable source code
- **line**: Line number in the chunk file

## Key Insight

Unlike most npm packages, Mastra's compiled JavaScript is **unminified** and fully readable.
You can read the actual implementation directly.

## Version

Package: @mastra/core
Version: 1.0.0-beta.18

# @mastra/claude-code — Observational Memory for Claude Code

## What This Is

This package brings Mastra's Observational Memory system to Claude Code. It prevents context window compaction by automatically compressing conversation history into dense observations that persist across sessions.

## How It Works

The system uses a three-tier architecture adapted from Mastra's memory system:

1. **Recent Context**: The current conversation in Claude Code
2. **Observations**: Compressed notes about what happened (extracted by an Observer)
3. **Reflections**: Further-compressed observations when they grow too large (produced by a Reflector)

When you start a Claude Code session, previous observations are injected into your context. As conversations get long, the Observer extracts key information into observations. When observations themselves grow too large, the Reflector condenses them.

## Development

- Source is in `src/`
- Build with `pnpm build` (uses tsup)
- Entry points: `src/index.ts` (library), `src/cli.ts` (CLI)
- No external API dependencies — uses the `claude` CLI for LLM calls
- File-based storage in `.mastra/memory/`

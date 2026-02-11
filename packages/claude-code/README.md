# @mastra/claude-code

Mastra Observational Memory for Claude Code. Never hit compaction again.

## The Problem

Claude Code has a finite context window. Long coding sessions accumulate tool calls, file reads, and conversation history until the context window fills up and compaction kicks in — discarding potentially important context. This leads to:

- **Lost context**: Claude forgets decisions made earlier in the session
- **Repeated mistakes**: Without memory of what was tried, Claude may retry failed approaches
- **Lost continuity**: Starting a new session means starting from scratch

## The Solution

This plugin brings [Mastra's Observational Memory](https://mastra.ai/docs/memory/observational-memory) system to Claude Code. Two background agents — an **Observer** and a **Reflector** — watch your conversations and maintain a dense observation log that replaces raw history as it grows.

The result: your Claude Code sessions have persistent, compressed memory that survives compaction and even persists across sessions.

### How It Works

```
Session 1: Long conversation about auth system...
  → Observer extracts: "User building Next.js app with Supabase auth,
     prefers server components, middleware handles redirects..."

Session 2: "Continue working on the auth system"
  → Claude already knows the full context from observations
```

The compression is typically 5-40x. A 50,000 token conversation becomes a few hundred tokens of observations. The Observer also tracks the **current task** and **suggested next action** so Claude picks up exactly where you left off.

## Quick Start

### 1. Install

```bash
npm install -g @mastra/claude-code
# or
npx @mastra/claude-code init
```

### 2. Initialize in your project

```bash
cd your-project
mastra-om init
```

This creates:
- `.mastra/memory/` directory for storing observations
- `.mastra/memory/config.json` with default settings
- `.mastra/memory/.gitignore` to keep state files out of git
- Adds an Observational Memory section to your `CLAUDE.md`

### 3. Use with Claude Code

The simplest integration is through your project's `CLAUDE.md`. After `mastra-om init`, your CLAUDE.md will include instructions for Claude to check and update observations.

For manual observation of long sessions, pipe the conversation context:

```bash
# Observe a conversation log
mastra-om observe conversation.txt

# Check memory status
mastra-om status

# Get observations for injection into a prompt
mastra-om inject

# Force reflection to compress observations
mastra-om reflect
```

## Commands

| Command | Description |
|---------|-------------|
| `mastra-om init` | Initialize memory directory and CLAUDE.md integration |
| `mastra-om status` | Show current memory state (tokens, generation, usage) |
| `mastra-om inject` | Output observations for system prompt injection |
| `mastra-om observe <file>` | Observe conversation context from a file |
| `mastra-om observe -` | Observe conversation context from stdin |
| `mastra-om reflect` | Force reflection to compress observations |
| `mastra-om reset` | Clear all observations and start fresh |
| `mastra-om plugin` | Run as Claude Code plugin (JSON protocol over stdin/stdout) |

## Configuration

Configuration is loaded from (in priority order):
1. Environment variables
2. CLI flags
3. `.mastra/memory/config.json`
4. Defaults

### Config File

```json
{
  "observationThreshold": 80000,
  "reflectionThreshold": 40000,
  "model": "claude-sonnet-4-20250514"
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MASTRA_OM_MEMORY_DIR` | `.mastra/memory` | Memory directory path |
| `MASTRA_OM_OBSERVATION_THRESHOLD` | `80000` | Tokens before Observer runs |
| `MASTRA_OM_REFLECTION_THRESHOLD` | `40000` | Observation tokens before Reflector runs |
| `MASTRA_OM_MODEL` | `claude-sonnet-4-20250514` | Model for Observer/Reflector |
| `MASTRA_OM_DEBUG` | `false` | Enable debug logging |

### CLI Flags

```bash
mastra-om observe context.txt --threshold 50000 --reflect-at 30000 --model claude-sonnet-4-20250514 --debug
```

## How Observations Work

### Observer

When conversation context exceeds the observation threshold (default: 80,000 tokens), the Observer runs. It extracts structured observations:

```
Date: Jan 15, 2026
* 🔴 (14:30) User building Next.js 15 app with App Router and Supabase auth
  * 🔴 App uses server components with client-side hydration
  * 🟡 Middleware handles auth redirects for protected routes
* 🟡 (14:45) Agent edited src/middleware.ts
  * Read existing middleware, found missing redirect logic
  * Added NextResponse.redirect for unauthenticated users
  * Tests passing after fix
* 🔴 (15:00) User prefers explicit error handling, not catch-all patterns
* 🔴 (15:10) Project structure: src/app/(auth)/ for auth pages, src/lib/supabase/ for client
```

Priority levels:
- 🔴 **High**: User facts, architecture decisions, preferences, critical context
- 🟡 **Medium**: Project details, tool results, learned information
- 🟢 **Low**: Minor details, uncertain observations

### Reflector

When observations exceed the reflection threshold (default: 40,000 tokens), the Reflector condenses them:
- Combines related items
- Condenses older observations more aggressively
- Retains more detail for recent context
- Preserves all critical information (file paths, architecture, preferences)
- Archives pre-reflection observations in `.mastra/memory/history/`

The Reflector retries with increasing compression if the first attempt doesn't reduce size enough.

## Programmatic API

```typescript
import { ObservationalMemoryEngine, resolveConfig } from '@mastra/claude-code';

const config = resolveConfig({
  observationThreshold: 50_000,
  reflectionThreshold: 30_000,
});

const engine = new ObservationalMemoryEngine(config);

// Get observations for injection
const injection = engine.getContextInjection();

// Process conversation context
const result = await engine.processConversation(conversationText);
console.log(result.message); // "Observed. Observations: 2,500 tokens"

// Force observation
await engine.forceObserve(conversationText);

// Force reflection
await engine.forceReflect();

// Get current state
const state = engine.getState();
console.log(state.observationTokens); // 2500
console.log(state.generationCount);   // 1
```

## Architecture

This plugin adapts Mastra's battle-tested Observational Memory system for Claude Code's environment:

| Mastra OM | Claude Code Plugin |
|-----------|-------------------|
| Database storage (Postgres/LibSQL/MongoDB) | File-based storage (`.mastra/memory/`) |
| Runs as in-process agent middleware | Runs as CLI tool / plugin |
| Real-time streaming markers | Batch observation on demand |
| Token thresholds: 30k observe / 40k reflect | Token thresholds: 80k observe / 40k reflect |
| Uses any AI SDK model | Uses `claude` CLI for LLM calls |

The higher default observation threshold (80k vs 30k) accounts for Claude Code's larger context windows and the batch nature of observation (vs Mastra's per-turn processing).

## File Structure

```
.mastra/
  memory/
    config.json          # Configuration
    state.json           # Current memory state (tokens, generation, timestamps)
    observations.md      # Human-readable observations
    .gitignore           # Keeps state files out of version control
    history/
      gen-0-2026-01-15T14-30-00-000Z.md   # Pre-reflection archive
      gen-1-2026-01-16T10-15-00-000Z.md   # Second generation archive
```

## Relationship to Mastra

This is a standalone adaptation of [Mastra's Observational Memory](https://mastra.ai/docs/memory/observational-memory) for Claude Code. It shares the same core concepts (Observer/Reflector pattern, priority-based observations, temporal anchoring) but is designed for file-based, CLI-driven usage rather than Mastra's database-backed agent middleware.

If you're building AI agents with Mastra, use the built-in `observationalMemory` option on the `Memory` class instead — it provides real-time, per-turn observation with streaming status updates and database persistence.

## License

Apache-2.0

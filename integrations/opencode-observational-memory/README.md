# opencode-observational-memory

OpenCode plugin for persistent memory using [Mastra's Observational Memory](https://mastra.ai) system.

**Runs locally** - no external server needed. Uses SQLite for storage.

## How It Works

Mastra's Observational Memory uses a three-agent architecture that runs entirely within the plugin:

1. **Actor** (your main agent): Sees observations + recent unobserved messages
2. **Observer**: Automatically extracts observations when history exceeds token threshold
3. **Reflector**: Condenses observations when they grow too large

This keeps context focused and relevant across long conversations and multiple sessions.

## Installation

```bash
npx opencode-observational-memory install
```

When prompted, choose a model for the Observer/Reflector agents (e.g., `google/gemini-2.0-flash`).

### Non-interactive Install

```bash
npx opencode-observational-memory install --no-tui --model google/gemini-2.0-flash
```

## Features

### Automatic Context Injection

On first message of each session, the plugin injects observations from previous conversations:

```
[MASTRA OBSERVATIONAL MEMORY]

## Observational Memory

The following observations were extracted from previous conversations:

- Project uses TypeScript with strict mode
- Build command: pnpm build
- Uses Vitest for testing
- Prefer functional components over class components
- API follows REST conventions with /api/v1 prefix

[/MASTRA OBSERVATIONAL MEMORY]
```

### Automatic Observation

As you chat, the system automatically:
- Saves messages to local SQLite database
- Triggers the Observer when message tokens exceed threshold (default: 30k)
- Triggers the Reflector when observation tokens exceed threshold (default: 40k)

### Compaction Integration

When OpenCode compacts your session, the plugin injects observations to preserve important context.

## Configuration

Create `~/.config/opencode/observational-memory.jsonc`:

```jsonc
{
  // Model for Observer and Reflector agents
  // Supports any AI SDK model ID
  "model": "google/gemini-2.0-flash",

  // Override model per agent (optional)
  // "observerModel": "openai/gpt-4o",
  // "reflectorModel": "anthropic/claude-3-sonnet",

  // Scope for observational memory
  // "resource" = shared across all threads for a user (default)
  // "thread" = specific to each conversation
  "scope": "resource",

  // Token threshold for triggering observation
  "messageTokenThreshold": 30000,

  // Token threshold for triggering reflection
  "observationTokenThreshold": 40000,

  // Custom database path
  // "dbPath": "~/.opencode/observational-memory.db"
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OM_MODEL` | Model for Observer/Reflector agents |
| `OM_OBSERVER_MODEL` | Override model for Observer |
| `OM_REFLECTOR_MODEL` | Override model for Reflector |
| `OM_DB_PATH` | Custom database path |

## Tool Usage

The `observational-memory` tool is available to the agent:

| Mode | Args | Description |
|------|------|-------------|
| `status` | - | Check memory system status |
| `get-observations` | `threadId?` | View current observations |
| `list-threads` | `limit?` | List conversation threads |
| `help` | - | Show usage guide |

## Commands

After installation, these commands are available in OpenCode:

- `/om-init` - Initialize memory with codebase knowledge
- `/om-status` - Check memory status and view observations

## Data Storage

All data is stored locally:

- **Database**: `~/.opencode/observational-memory.db` (SQLite via LibSQL)
- **Logs**: `~/.opencode-observational-memory.log`
- **Config**: `~/.config/opencode/observational-memory.jsonc`

## Privacy

Content in `<private>` tags is redacted before storing:

```
API key is <private>sk-abc123</private>
```

## How Observations Are Created

1. **Conversation happens** - Messages are saved to local database
2. **Threshold reached** - When unobserved messages exceed token threshold
3. **Observer runs** - Extracts key observations from recent messages
4. **Observations stored** - Saved to database for future sessions
5. **Reflector runs** - When observations get too large, condenses them

This happens automatically in the background - no manual intervention needed.

## Logs

```bash
tail -f ~/.opencode-observational-memory.log
```

## License

MIT

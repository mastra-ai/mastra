# Mastra Code

A terminal-based coding agent TUI built with [Mastra](https://mastra.ai) and [pi-tui](https://github.com/badlogic/pi-mono).

## Features

- 🤖 **Multi-model support**: Use Claude, GPT, Gemini, and 70+ other models via Mastra's unified model router
- 🔐 **OAuth login**: Authenticate with Anthropic (Claude Max) and OpenAI (ChatGPT Plus/Codex)
- 💾 **Persistent conversations**: Threads are saved per-project and resume automatically
- 🛠️ **Coding tools**: View files, edit code, run shell commands
- 📊 **Token tracking**: Monitor usage with persistent token counts per thread
- 🎨 **Beautiful TUI**: Polished terminal interface with streaming responses

## Installation

Install `mastracode` globally with your package manager of choice.

```bash
npm install -g mastracode
```

If you prefer not to install packages globally, you can use `npx`:

```bash
npx mastracode
```

On first launch, an interactive onboarding wizard guides you through:

1. **Authentication** — log in with your AI provider (Anthropic, OpenAI, etc.)
2. **Model packs** — choose default models for each mode (build / plan / fast)
3. **Observational Memory** — pick a model for OM (learns about you over time)
4. **YOLO mode** — auto-approve tool calls, or require manual confirmation

You can re-run setup anytime with `/setup`.

## Usage

### Starting a conversation

Simply type your message and press Enter. The agent will respond with streaming text.

### Slash commands

| Command    | Description                               |
| ---------- | ----------------------------------------- |
| `/new`     | Start a new conversation thread           |
| `/threads` | List all threads for this project         |
| `/models`  | Select a different AI model               |
| `/cost`    | Show token usage for current conversation |
| `/login`   | Authenticate with OAuth providers         |
| `/logout`  | Log out from a provider                   |
| `/setup` | Re-run the interactive setup wizard  |
| `/help`    | Show available commands                   |
| `/exit`    | Exit the TUI                              |

### Keyboard shortcuts

| Shortcut | Action                            |
| -------- | --------------------------------- |
| `Ctrl+C` | Interrupt current operation       |
| `Ctrl+D` | Exit (when editor is empty)       |
| `Ctrl+T` | Toggle thinking blocks visibility |
| `Ctrl+E` | Expand/collapse all tool outputs  |

## Configuration

### Project-based threads

Threads are automatically scoped to your project based on:

1. Git remote URL (if available)
2. Absolute path (fallback)

This means conversations are shared across clones, worktrees, and SSH/HTTPS URLs of the same repository.

### Database location

The SQLite database is stored in your system's application data directory:

- **macOS**: `~/Library/Application Support/mastracode/`
- **Linux**: `~/.local/share/mastracode/`
- **Windows**: `%APPDATA%/mastracode/`

### Authentication

OAuth credentials are stored alongside the database in `auth.json`.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                          TUI                                │
│  (pi-tui components: Editor, Markdown, Loader, etc.)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Harness                              │
│  - Mode management (plan, build, review)                    │
│  - Thread/message persistence                               │
│  - Event system for TUI updates                             │
│  - State management with Zod schemas                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Mastra Agent                           │
│  - Dynamic model selection                                  │
│  - Tool execution (view, edit, bash)                        │
│  - Memory integration                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      LibSQL Storage                         │
│  - Thread persistence                                       │
│  - Message history                                          │
│  - Token usage tracking                                     │
└─────────────────────────────────────────────────────────────┘
```

## Development

```bash
# Run in development mode (with watch)
pnpm dev

# Type check
pnpm typecheck

# Build
pnpm build
```

## Credits

- [Mastra](https://mastra.ai) - AI agent framework
- [pi-mono](https://github.com/badlogic/pi-mono) - TUI primitives and inspiration
- [OpenCode](https://github.com/sst/opencode) - OAuth provider patterns

## License

Apache-2.0

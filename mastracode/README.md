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

## Prerequisites

### Optional: `fd` for file autocomplete

The `@` file autocomplete feature uses [`fd`](https://github.com/sharkdp/fd), a fast file finder that respects `.gitignore`. Without it, `@` autocomplete silently does nothing.

Install with your package manager:

```bash
# macOS
brew install fd

# Ubuntu/Debian
sudo apt install fd-find

# Arch
sudo pacman -S fd
```

On Ubuntu/Debian the binary is called `fdfind` — mastracode detects both `fd` and `fdfind` automatically.

## Usage

### Starting a conversation

Type your message and press Enter. The agent responds with streaming text.

### `@` file references

Type `@` followed by a partial filename to fuzzy-search project files and reference them in your message. This requires `fd` to be installed (see [Prerequisites](#prerequisites)).

- `@setup` — fuzzy-matches files like `setup.ts`, `setup.py`, etc.
- `@src/tui` — scoped search within a directory
- `@"path with spaces"` — quoted form for paths containing spaces

Select a suggestion with arrow keys and press Tab to insert it.

### Slash commands

| Command           | Description                                  |
| ----------------- | -------------------------------------------- |
| `/new`            | Start a new conversation thread              |
| `/threads`        | List and switch between threads              |
| `/models`         | Switch/manage model packs (built-in/custom) |
| `/mode`           | Switch agent mode                            |
| `/subagents`      | Configure subagent model defaults            |
| `/om`             | Configure Observational Memory models        |
| `/think`          | Set thinking level (Anthropic)               |
| `/skills`         | List available skills                        |
| `/diff`           | Show modified files or git diff              |
| `/name`           | Rename current thread                        |
| `/cost`           | Show token usage and estimated costs         |
| `/review`         | Review a GitHub pull request                 |
| `/hooks`          | Show/reload configured hooks                 |
| `/mcp`            | Show/reload MCP server connections           |
| `/sandbox`        | Manage allowed paths (add/remove dirs)       |
| `/permissions`    | View/manage tool approval permissions        |
| `/settings`       | General settings (notifications, YOLO, etc.) |
| `/yolo`           | Toggle YOLO mode (auto-approve all tools)    |
| `/resource`       | Show/switch resource ID (tag for sharing)    |
| `/thread:tag-dir` | Tag current thread with this directory       |
| `/login`          | Authenticate with OAuth providers            |
| `/logout`         | Log out from a provider                      |
| `/setup`          | Re-run the interactive setup wizard          |
| `/help`           | Show available commands                      |
| `/exit`           | Exit the TUI                                 |

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

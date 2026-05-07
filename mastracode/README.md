# Mastra Code

A coding agent that never compacts. Built with [Mastra](https://mastra.ai) and [pi-tui](https://github.com/badlogic/pi-mono).

Learn more in the [documentation](https://code.mastra.ai/) and [announcement post](https://mastra.ai/blog/announcing-mastra-code).

![Screenshot of the Mastra Code TUI. At the top it shows in green letters "Mastra Code". It then displays the version, project, resource ID, and user. The user and assistant message have green borders. At the bottom is a green input field. Below the input is on the left the current mode and model displayed. In the middle the Observational Memory status is shown. On the right is the current directory.](https://res.cloudinary.com/mastra-assets/image/upload/v1778048981/mastracode-init_tny2pb.png)

## Features

- **Observational Memory built-in**: Never deal with compaction again. [Observational Memory](https://mastra.ai/docs/memory/observational-memory) automatically extracts and stores observations from every conversation, then injects relevant context into future requests.
- **Multi-model support**: Use Claude, GPT, Gemini, and thousands of other models via Mastra's unified model router
- **OAuth login**: Authenticate with Anthropic (Claude Max) and OpenAI (ChatGPT Plus/Codex)
- **Persistent conversations**: Threads are saved per-project and resume automatically
- **Coding tools**: View files, edit code, run shell commands
- **Plan persistence**: Approved plans are saved as markdown files for future reference
- **Token tracking**: Monitor usage with persistent token counts per thread
- **Beautiful TUI**: Polished terminal interface with streaming responses

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

1. **Authentication**: Log in with your AI provider (Anthropic, OpenAI, etc.)
2. **Model packs**: Choose default models for each mode (build / plan / fast)
3. **Observational Memory**: Pick a model for OM (learns about you over time)
4. **YOLO mode**: Auto-approve tool calls, or require manual confirmation

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

Type your message and press Enter. If the agent is already working, Enter queues your next message and sends it after the current run finishes.

### `@` file references

Type `@` followed by a partial filename to fuzzy-search project files and reference them in your message. This requires `fd` to be installed (see [Prerequisites](#prerequisites)).

- `@setup` — fuzzy-matches files like `setup.ts`, `setup.py`, etc.
- `@src/tui` — scoped search within a directory
- `@"path with spaces"` — quoted form for paths containing spaces

Select a suggestion with arrow keys and press Tab to insert it.

### Slash commands

| Command             | Description                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| `/new`              | Start a new conversation thread                                             |
| `/threads`          | List and switch between threads with freshness-checked cached lazy previews |
| `/models`           | Switch/manage model packs (built-in/custom)                                 |
| `/custom-providers` | Manage custom OpenAI-compatible providers/models                            |
| `/mode`             | Switch agent mode                                                           |
| `/subagents`        | Configure subagent model defaults                                           |
| `/om`               | Configure Observational Memory models                                       |
| `/think`            | Set thinking level (Anthropic)                                              |
| `/skills`           | List available skills                                                       |
| `/diff`             | Show modified files or git diff                                             |
| `/name`             | Rename current thread                                                       |
| `/cost`             | Show token usage and estimated costs                                        |
| `/review`           | Review a GitHub pull request                                                |
| `/hooks`            | Show/reload configured hooks                                                |
| `/mcp`              | Show/reload MCP server connections                                          |
| `/sandbox`          | Manage allowed paths (add/remove dirs)                                      |
| `/permissions`      | View/manage tool approval permissions                                       |
| `/settings`         | General settings (notifications, YOLO, etc.)                                |
| `/yolo`             | Toggle YOLO mode (auto-approve all tools)                                   |
| `/resource`         | Show/switch resource ID (tag for sharing)                                   |
| `/thread:tag-dir`   | Tag current thread with this directory                                      |
| `/login`            | Authenticate with OAuth providers                                           |
| `/logout`           | Log out from a provider                                                     |
| `/setup`            | Re-run the interactive setup wizard                                         |
| `/help`             | Show available commands                                                     |
| `/exit`             | Exit the TUI                                                                |

### Keyboard shortcuts

| Shortcut    | Action                                                          |
| ----------- | --------------------------------------------------------------- |
| `Ctrl+C`    | Interrupt current operation or clear input                      |
| `Ctrl+C` ×2 | Exit (double-tap)                                               |
| `Ctrl+D`    | Exit (when editor is empty)                                     |
| `Ctrl+Z`    | Suspend process (`fg` to resume)                                |
| `Alt+Z`     | Undo last clear                                                 |
| `Ctrl+T`    | Toggle thinking blocks visibility                               |
| `Ctrl+E`    | Expand/collapse all tool outputs                                |
| `Enter`     | Send a message, or queue a follow-up while the agent is running |
| `Ctrl+Y`    | Toggle YOLO mode                                                |

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

For **Anthropic** models, mastracode supports two authentication methods:

1. **Claude Max OAuth (primary)**: Use `/login` to authenticate with a Claude Pro/Max subscription.
2. **API key (fallback)**: Set the `ANTHROPIC_API_KEY` environment variable for direct API access. This is used when not logged in via OAuth.

When both are available, Claude Max OAuth takes priority.

For **other providers** (OpenAI, Google, etc.), set the corresponding environment variable (e.g., `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`) or use OAuth where supported.

Credentials are stored alongside the database in `auth.json`.

### Custom providers and models

Use `/custom-providers` to manage OpenAI-compatible providers with:

- provider `name`
- provider `url`
- optional provider `apiKey`
- one or more custom model IDs per provider

Once saved, provider models appear in existing selectors like `/models` and `/subagents` and can be selected like built-in models.

Custom providers are stored in `settings.json` in the same app data directory. If you save an API key, it is stored locally in plaintext, so use a machine/user profile you trust.

### macOS sleep prevention

On macOS, Mastra Code starts the built-in `caffeinate` utility while the agent is actively running, then stops it as soon as the run completes, errors, aborts, or the TUI exits. Idle sessions do not keep your machine awake.

To disable this behavior, set `MASTRACODE_DISABLE_CAFFEINATE=1` before launching Mastra Code:

```bash
export MASTRACODE_DISABLE_CAFFEINATE=1
```

### Plan persistence

When you approve a plan (via `submit_plan`), it is saved as a markdown file in the app data directory:

- **macOS**: `~/Library/Application Support/mastracode/plans/<resourceId>/`
- **Linux**: `~/.local/share/mastracode/plans/<resourceId>/`
- **Windows**: `%APPDATA%/mastracode/plans/<resourceId>/`

Files are named `<timestamp>-<slugified-title>.md` and contain the plan title, approval timestamp, and full plan body.

To save plans to a project-local directory instead, set the `MASTRA_PLANS_DIR` environment variable:

```bash
export MASTRA_PLANS_DIR=.mastracode/plans
```

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

- [Mastra](https://mastra.ai): AI agent framework
- [pi-mono](https://github.com/badlogic/pi-mono): TUI primitives and inspiration
- [OpenCode](https://github.com/sst/opencode): OAuth provider patterns

## License

Apache-2.0

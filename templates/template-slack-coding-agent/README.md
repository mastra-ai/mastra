# Slack Coding Agent Template

A Mastra template for a Slack-based coding agent powered by the **MastraCode Harness** and **E2B cloud sandboxes**. Send messages in Slack and get a fully autonomous coding assistant that can read, write, and execute code in an isolated sandbox.

## Features

- **E2B Cloud Sandboxes** — Each Slack thread gets its own isolated cloud sandbox
- **Template-based Repo Cloning** — Repos are baked into E2B templates for instant cold starts
- **Real-time Streaming** — Tool usage and agent responses stream to Slack in real-time
- **Git Operations** — Commit, push, create PRs directly from Slack
- **Session Management** — Auto-pause, reconnect, and cleanup of idle sandboxes
- **Thread-scoped Sessions** — Each Slack thread is an independent coding session

## Setup

### 1. Install dependencies

```bash
npm install
# or
pnpm install
```

### 2. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From Scratch**
2. Under **OAuth & Permissions**, add these **Bot Token Scopes**:
   - `app_mentions:read`
   - `chat:write`
   - `channels:history` (for reading messages in public channels)
   - `groups:history` (for reading messages in private channels)
   - `im:history` (for reading direct messages)
3. **Install to Workspace** and copy the **Bot User OAuth Token** (`xoxb-...`)
4. Under **Basic Information**, copy the **Signing Secret**
5. Under **Event Subscriptions**:
   - Enable Events
   - Set the Request URL to: `https://your-server.com/api/slack/coding/events`
   - Subscribe to bot events: `app_mention`, `message.im`

### 3. Get API Keys

- **Anthropic API Key**: [console.anthropic.com](https://console.anthropic.com)
- **E2B API Key**: [e2b.dev](https://e2b.dev) (sign up for cloud sandboxes)
- **GitHub Token**: [github.com/settings/tokens](https://github.com/settings/tokens) (needs `repo` scope for private repos)

### 4. Configure environment

```bash
cp .env.example .env
```

Fill in all the values in `.env`.

### 5. Start the server

```bash
npm run dev
```

## Usage

### Basic Coding

Mention the bot in a Slack channel or DM it:

> @coding-agent Read the README.md and explain what this project does

> @coding-agent Fix the TypeScript errors in src/utils.ts

> @coding-agent Add a new API endpoint for user registration

### Commands

| Command | Description |
|---------|-------------|
| `clone <repo-url> [branch]` | Set up a sandbox with a specific repo |
| `status` | Show current session status and tasks |
| `summary` | Ask the agent to summarize work done |
| `commit [message]` | Commit and push changes |
| `pr [title]` | Create a pull request |
| `destroy` | Tear down the sandbox |

### Example Workflow

```
User: clone https://github.com/myorg/myapp.git main
Bot:  🚀 Setting up sandbox with myorg/myapp...
Bot:  ✅ Sandbox ready! Send me a coding task.

User: Fix the failing tests in src/auth/
Bot:  📂 Reading src/auth/...
      🔍 Searching for test files...
      ⚡ Running npm test...
      🔧 Editing src/auth/middleware.ts...
      ⚡ Running npm test...
      ✅ All 12 tests passing. Fixed the JWT validation...

User: commit fix auth middleware validation
Bot:  ⚡ git add -A && git commit && git push
      ✅ Committed and pushed: "fix: auth middleware validation"

User: pr Fix auth middleware JWT validation
Bot:  ⚡ gh pr create...
      ✅ PR created: https://github.com/myorg/myapp/pull/42
```

## Architecture

```
Slack Event → Route Handler → Harness.sendMessage() → Agent in E2B Sandbox
                                    ↓
                              Harness Events → Slack Message Updates
```

- **One Harness per Slack thread** — each thread is an isolated coding session
- **E2B sandbox per Harness** — isolated cloud environment with the repo pre-cloned
- **Template caching** — E2B builds the template once, reuses it for subsequent sessions
- **Auto-pause** — Sandboxes pause after 30 min idle, reconnect on next message
- **Cleanup** — Sessions destroyed after 2 hours of inactivity

## File Structure

```
src/mastra/
├── index.ts                      # Mastra instance
├── coding/
│   ├── harness-factory.ts        # Harness creation & caching
│   ├── workspace-config.ts       # E2B sandbox + template config
│   ├── sandbox-manager.ts        # Lifecycle management
│   └── system-prompt.ts          # Agent system prompt
└── slack/
    ├── routes.ts                 # Slack event handling + commands
    ├── harness-streaming.ts      # Harness events → Slack updates
    └── verify.ts                 # Slack request verification
```

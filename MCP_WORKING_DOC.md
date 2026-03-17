# MCP Server Connection & Management — Working Document

> Working document for improving MastraCode's MCP system to match Claude Code's UX.
> Branch: `fix-mastracode-startup`

---

## Current State: What We Have

### Architecture

Our MCP system lives in `mastracode/src/mcp/` with three layers:

1. **Config loading** (`config.ts`) — Reads from three sources with priority:
   - `.claude/settings.local.json` (Claude Code compat — lowest)
   - `~/.mastracode/mcp.json` (global)
   - `.mastracode/mcp.json` (project — highest)

2. **Manager** (`manager.ts`) — Wraps `@mastra/mcp`'s `MCPClient`:
   - `createMcpManager()` creates a manager at startup
   - `initInBackground()` connects to all servers asynchronously
   - `getTools()` returns namespaced tools (`serverName_toolName`)
   - `reload()` disconnects + reconnects from disk
   - Tracks per-server status (connected/failed/skipped)

3. **TUI command** (`tui/commands/mcp.ts`) — `/mcp` slash command:
   - Shows server statuses with ✓/✗ icons
   - Lists tools per server
   - Shows config file paths
   - `/mcp reload` to reconnect

### Startup Flow (after fixes)

```
1. createMastraCode() → creates mcpManager
2. TUI starts → ui.start() takes over terminal
3. After ui.start(), mcpManager.initInBackground() fires
4. Results displayed via showInfo() (proper TUI rendering)
```

### Known Issues (remaining)

1. **Silently-skipped servers show as "connected"** — `MCPClient.listTools()` handles per-server failures internally by skipping them. The manager can't distinguish a server that connected with 0 tools from one that failed silently. Broken servers show as `✓ connected (0 tools)` instead of `✗ failed`.

2. **No "connecting..." state** — There's no visual indicator while servers are connecting. You just see the initial message, then eventually the result.

3. **No individual server management** — Can't enable/disable/add/remove servers from the TUI. Must edit JSON files.

### Fixed Issues ✅

1. ~~**`console.info` appears in input box**~~ — Deferred MCP init to after `ui.start()`, using `showInfo()` for status messages
2. ~~**Child process stderr flooding terminal**~~ — Added `stderr: 'pipe'` to stdio server defs
3. ~~**All-or-nothing connection assumption**~~ — Investigated upstream `MCPClient.listTools()` — it already iterates servers individually with per-server try/catch. Failed servers are logged and skipped internally. Per-server MCPClient rewrite was unnecessary.

---

## Claude Code: How It Works

### Connection Behavior

Based on research:

1. **Startup**: Claude Code reads `.mcp.json` (project), `~/.claude.json` (user/global), and managed configs. On launch, it shows `✔ Found N MCP servers • /mcp` and connects in the background.

2. **Background connection**: Servers connect independently (not all-or-nothing). Each server has its own connection lifecycle.

3. **`/mcp` command output**: Shows a clean status list:
   ```
   MCP Server Status

   • server-name: connected
   • other-server: connected
   ```

4. **Dynamic updates**: Claude Code supports `list_changed` notifications — MCP servers can dynamically update their tools without reconnection.

5. **Server management CLI** (`claude mcp` subcommands outside the TUI):
   - `claude mcp add <name> ...` — Add a server
   - `claude mcp remove <name>` — Remove a server
   - `claude mcp list` — List configured servers
   - `claude mcp get <name>` — Show server details
   - Supports scopes: `local` (project), `project` (shared .mcp.json), `user` (global)

6. **OAuth support**: `/mcp` can also trigger OAuth authentication flows for remote servers.

7. **New server discovery**: When a new `.mcp.json` is found, Claude Code shows a prompt asking which servers to enable (checkbox-style selector).

8. **Configurable timeout**: `MCP_TIMEOUT` env var controls startup connection timeout.

### `/mcp` Display (from screenshot)

Claude Code's `/mcp` is an **interactive selector**, not just a text dump:

```
Manage MCP servers          ← green header
4 servers                   ← count

  Built-in MCPs (always available)   ← category grouping
› claude-in-chrome · ✔ connected     ← ✔ green, `›` = cursor (navigable)
  plugin:linear:linear · ✗ failed    ← ✗ red
  plugin:Notion:notion · ✗ failed
  plugin:slack:slack · ✗ failed

※ Run claude --debug to see error logs
https://code.claude.com/docs/en/mcp for help
↑↓ to navigate · Enter to confirm · Esc to cancel   ← interactive!
```

Key UX details:
- **Interactive list**: Arrow keys navigate, Enter selects a server (likely shows actions: reconnect, remove, view error, etc.)
- **Category grouping**: "Built-in MCPs" vs user-configured
- **Status icons**: ✔ connected (green) / ✗ failed (red)
- **Debug guidance**: Tells you how to get more info
- **Docs link**: Direct URL to MCP help page
- **Esc to dismiss**: Standard modal pattern

---

## Gap Analysis: What We Need to Fix/Add

### P0 — Must Fix

| Issue | Status | Notes |
|-------|--------|-------|
| ~~**Connection status in input box**~~ | ✅ DONE | Deferred init to after `ui.start()`, use `showInfo()` |
| ~~**Stderr flooding terminal**~~ | ✅ DONE | `stderr: 'pipe'` on stdio server defs |
| ~~**All-or-nothing connection**~~ | ✅ DONE | Upstream MCPClient already handles per-server isolation |
| **Silently-skipped servers show as connected** | 🔧 NEXT | Use `listToolsets()` to detect which servers actually connected |
| **No connecting state** | ⬜ TODO | Show "connecting..." per server, then update to connected/failed |

### P1 — Should Add

| Feature | Notes |
|---------|-------|
| **Per-server connect/disconnect** | `/mcp enable <name>`, `/mcp disable <name>` |
| **Add server from TUI** | `/mcp add <name> <command/url>` — writes to project or global config |
| **Remove server from TUI** | `/mcp remove <name>` |
| **Server detail view** | `/mcp detail <name>` — show transport, env, tools, connection time |
| **Startup timeout** | `MCP_TIMEOUT` env var or config option |

### P2 — Nice to Have

| Feature | Notes |
|---------|-------|
| **list_changed support** | Auto-refresh tools when server sends notification |
| **New server discovery prompt** | When new .mcp.json found, prompt user to enable servers |
| **OAuth flow** | `/mcp` triggers OAuth for remote servers |
| **Scope management** | Support local/project/user scopes like Claude Code |

---

## Implementation Plan

### Step 1: Fix stderr flooding + console.info race (P0) ✅ DONE

**Fixed** by:
1. Added `stderr: 'pipe'` to `buildServerDefs()` in manager.ts — suppresses child process debug output from flooding terminal
2. Moved `initInBackground()` from main.ts into MastraTUI's `init()` after `ui.start()` — uses `showInfo()` for status messages
3. Headless mode has its own independent path, unaffected

### Step 2: Per-server independent connection (P0) ✅ DONE (no changes needed)

**Finding**: Upstream `MCPClient.listTools()` already iterates servers individually with per-server try/catch — failed servers are logged and skipped, not all-or-nothing. The per-server MCPClient rewrite was unnecessary and was reverted.

### Step 3: Status detection improvement (P0) ← CURRENT

**Problem**: The manager marks ALL servers as `connected: true` after `listTools()` succeeds, even for servers that were silently skipped (0 tools). A broken server shows `✓ connected (0 tools)` instead of `✗ failed`.

**Approach**: Use `listToolsets()` instead of `listTools()`. It returns `Record<serverName, Record<toolName, Tool>>` — grouped by server name. Servers that failed to connect won't have an entry, letting us detect which servers actually connected vs which were silently skipped.

### Step 4: Show "connecting..." state (P0)

- Add a `status: 'connecting' | 'connected' | 'failed' | 'disconnected'` field to `McpServerStatus`
- On startup, set all servers to 'connecting'
- Update status line or info area as each connects/fails
- Consider a subtle indicator in the status bar (e.g., "MCP: 2/3 ⟳")

### Step 3.5: Per-server stderr logging (Future — when building interactive /mcp TUI)

When we build the interactive `/mcp` selector, pipe each server's stderr to its own buffer so it can be displayed in the server detail view. This gives you:
- Startup logs (mcp-remote JSON-RPC handshake, OAuth discovery, etc.)
- Runtime errors
- Tool list changes
- Basically a "console" per server

This depends on the interactive TUI work — user will post the current `/mcp` command screenshot before we start that.

### Step 4: Interactive `/mcp` selector (P1)

Replace the current text-dump `/mcp` with an **interactive navigable list** like Claude Code:

```
Manage MCP servers
3 servers

  › server-name · ✔ connected        ← arrow keys to navigate
    other-server · ✗ failed
    third-server · ✔ connected

↑↓ to navigate · Enter to confirm · Esc to cancel
```

Enter on a server shows actions: reconnect, view tools, view error, remove, etc.

Also extend `/mcp` with subcommands:
- `/mcp add <name> <command|url> [args...]` — writes to `.mastracode/mcp.json`
- `/mcp remove <name>` — removes from config, disconnects
- `/mcp enable <name>` / `/mcp disable <name>` — toggle without removing config
- `/mcp detail <name>` — show detailed info
- `/mcp reload` — already exists, keep it

---

## Open Questions

1. Should we support Claude Code's `.mcp.json` format directly? (We already read `.claude/settings.local.json` — should we also read `.mcp.json`?)
2. Should `/mcp add` write to project or global config by default?
3. Do we want the checkbox-style "new servers found" prompt on startup?
4. Should we support `MCP_TIMEOUT` env var for connection timeout?

---

## Files Modified

- `mastracode/src/mcp/manager.ts` — ✅ stderr fix, comment fix, `initInBackground()` added
- `mastracode/src/main.ts` — ✅ Removed fire-and-forget `initInBackground()` + `console.info()`
- `mastracode/src/tui/mastra-tui.ts` — ✅ MCP init after `ui.start()` with `showInfo()`
- `mastracode/src/headless.ts` — ✅ Export fix for `McpInitResult`
- `mastracode/src/mcp/index.ts` — ✅ Export `McpInitResult` type
- `mastracode/src/mcp/__tests__/manager.test.ts` — ✅ Tests aligned with single-MCPClient architecture

## Files Still To Modify

- `mastracode/src/mcp/manager.ts` — Switch from `listTools()` to `listToolsets()` for status detection
- `mastracode/src/mcp/types.ts` — Add 'connecting' status (Step 4)
- `mastracode/src/mcp/config.ts` — Add write support for add/remove (P1)
- `mastracode/src/tui/commands/mcp.ts` — Interactive selector, subcommands (P1)
- `mastracode/src/tui/status-line.ts` — MCP connecting indicator (Step 4)
- `mastracode/src/tui/state.ts` — MCP state fields (P1)

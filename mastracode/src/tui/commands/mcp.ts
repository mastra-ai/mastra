import { McpSelectorComponent } from '../components/mcp-selector.js';
import { showInfo } from '../display.js';
import type { SlashCommandContext } from './types.js';

export async function handleMcpCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const mm = ctx.mcpManager;
  if (!mm) {
    ctx.showInfo('MCP system not initialized.');
    return;
  }

  const subcommand = args[0];

  // /mcp reload — reconnect all servers (also available from the selector)
  if (subcommand === 'reload') {
    await reloadServers(ctx);
    return;
  }

  // /mcp status — text-only status dump (non-interactive fallback)
  if (subcommand === 'status') {
    showTextStatus(ctx);
    return;
  }

  const paths = mm.getConfigPaths();

  // No servers? Show setup instructions.
  if (!mm.hasServers()) {
    ctx.showInfo(
      `No MCP servers configured.\n\n` +
        `Add servers to:\n` +
        `  ${paths.project} (project)\n` +
        `  ${paths.global} (global)\n` +
        `  ${paths.claude} (Claude Code compat)\n\n` +
        `Example mcp.json:\n` +
        `  {\n` +
        `    "mcpServers": {\n` +
        `      "filesystem": {\n` +
        `        "command": "npx",\n` +
        `        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],\n` +
        `        "env": {}\n` +
        `      },\n` +
        `      "remote-api": {\n` +
        `        "url": "https://mcp.example.com/sse",\n` +
        `        "headers": { "Authorization": "Bearer <token>" }\n` +
        `      }\n` +
        `    }\n` +
        `  }\n\n` +
        `Note: For dynamic auth (token refresh), use a stdio wrapper.\n` +
        `"headers" only supports static values.`,
    );
    return;
  }

  // Default: show interactive selector overlay
  const statuses = mm.getServerStatuses();
  const skipped = mm.getSkippedServers();

  const selector = new McpSelectorComponent({
    tui: ctx.state.ui,
    statuses,
    skipped,
    configPaths: paths,
    getStatuses: () => ({
      statuses: mm.getServerStatuses(),
      skipped: mm.getSkippedServers(),
    }),
    onReloadAll: async () => {
      await mm.reload();
      return {
        statuses: mm.getServerStatuses(),
        skipped: mm.getSkippedServers(),
      };
    },
    onReconnectServer: async (name: string) => {
      return mm.reconnectServer(name);
    },
    getServerLogs: (name: string) => {
      return mm.getServerLogs(name);
    },
    showInfo: (msg: string) => {
      showInfo(ctx.state, msg);
    },
    onClose: () => {
      selector.dispose();
      ctx.state.ui.hideOverlay();
    },
  });

  ctx.state.ui.showOverlay(selector, {
    width: '80%',
    maxHeight: '70%',
    anchor: 'center',
  });
  selector.focused = true;
}

async function reloadServers(ctx: SlashCommandContext): Promise<void> {
  const mm = ctx.mcpManager;
  if (!mm) return;
  ctx.showInfo('MCP: Reconnecting to servers...');
  try {
    await mm.reload();
    const statuses = mm.getServerStatuses();
    const connected = statuses.filter(s => s.connected);
    const totalTools = connected.reduce((sum, s) => sum + s.toolCount, 0);
    ctx.showInfo(`MCP: Reloaded. ${connected.length} server(s) connected, ${totalTools} tool(s).`);
    for (const s of statuses.filter(s => !s.connected)) {
      ctx.showInfo(`MCP: Failed to connect to "${s.name}": ${s.error}`);
    }
  } catch (error) {
    ctx.showError(`MCP reload failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function showTextStatus(ctx: SlashCommandContext): void {
  const mm = ctx.mcpManager;
  if (!mm) return;
  const paths = mm.getConfigPaths();
  const statuses = mm.getServerStatuses();
  const skipped = mm.getSkippedServers();

  const lines: string[] = [`MCP Servers:`];
  lines.push(`  Project: ${paths.project}`);
  lines.push(`  Global:  ${paths.global}`);
  lines.push(`  Claude:  ${paths.claude}`);
  lines.push('');

  for (const status of statuses) {
    const icon = status.connecting ? '⟳' : status.connected ? '\u2713' : '\u2717';
    const state = status.connecting ? 'connecting...' : status.connected ? 'connected' : `error: ${status.error}`;
    lines.push(`  ${icon} ${status.name} [${status.transport}] (${state})`);
    if (status.toolNames.length > 0) {
      for (const toolName of status.toolNames) {
        lines.push(`      - ${toolName}`);
      }
    }
  }

  if (skipped.length > 0) {
    lines.push('');
    lines.push('  Skipped:');
    for (const s of skipped) {
      lines.push(`    \u2717 ${s.name}: ${s.reason}`);
    }
  }

  lines.push('');
  lines.push(`  /mcp reload - Disconnect and reconnect all servers`);

  ctx.showInfo(lines.join('\n'));
}

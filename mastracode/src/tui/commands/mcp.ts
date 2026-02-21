import type { SlashCommandContext } from './types.js';

export async function handleMcpCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const mm = ctx.mcpManager;
  if (!mm) {
    ctx.showInfo('MCP system not initialized.');
    return;
  }

  const subcommand = args[0];
  if (subcommand === 'reload') {
    ctx.showInfo('MCP: Reconnecting to servers...');
    try {
      await mm.reload();
      const statuses = mm.getServerStatuses();
      const connected = statuses.filter(s => s.connected);
      const totalTools = connected.reduce((sum, s) => sum + s.toolCount, 0);
      ctx.showInfo(`MCP: Reloaded. ${connected.length} server(s) connected, ${totalTools} tool(s).`);
    } catch (error) {
      ctx.showError(`MCP reload failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return;
  }

  const paths = mm.getConfigPaths();

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
        `      }\n` +
        `    }\n` +
        `  }`,
    );
    return;
  }

  const statuses = mm.getServerStatuses();
  const lines: string[] = [`MCP Servers:`];
  lines.push(`  Project: ${paths.project}`);
  lines.push(`  Global:  ${paths.global}`);
  lines.push(`  Claude:  ${paths.claude}`);
  lines.push('');

  for (const status of statuses) {
    const icon = status.connected ? '\u2713' : '\u2717';
    const state = status.connected ? 'connected' : `error: ${status.error}`;
    lines.push(`  ${icon} ${status.name} (${state})`);
    if (status.toolNames.length > 0) {
      for (const toolName of status.toolNames) {
        lines.push(`      - ${toolName}`);
      }
    }
  }

  lines.push('');
  lines.push(`  /mcp reload - Disconnect and reconnect all servers`);

  ctx.showInfo(lines.join('\n'));
}

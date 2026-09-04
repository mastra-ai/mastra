import { McpSelectorComponent } from '../components/mcp-selector.js';
import { showInfo } from '../display.js';
import { openUrlInBrowser } from '../open-url.js';
import { showModalOverlay } from '../overlay.js';
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

  // /mcp disable <name|all> [--global] and /mcp enable <name|all> [--global]
  if (subcommand === 'disable' || subcommand === 'enable') {
    const rest = args.slice(1);
    const global = rest.includes('--global') || rest.includes('-g');
    const target = rest.find(a => a !== '--global' && a !== '-g');
    await setDisabled(ctx, subcommand === 'disable', target, global);
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
        `Servers that require OAuth can be added with just a "url" —\n` +
        `authenticate them from the /mcp selector.`,
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
    onAuthenticateServer: async (name: string) => {
      return mm.authenticateServer(name, {
        onAuthorizationUrl: (url: string) => {
          // Always print the URL so headless (or failed-open) environments can
          // complete the flow manually; opening the browser is best-effort.
          showInfo(ctx.state, `MCP: To authenticate "${name}", open:\n  ${url}`);
          if (process.env.MASTRA_MCP_OAUTH_NO_BROWSER !== '1') {
            openUrlInBrowser(url);
          }
        },
      });
    },
    onCancelAuthenticateServer: async (name: string) => {
      return mm.cancelServerAuthentication(name);
    },
    onSetServerDisabled: async (name: string, disabled: boolean, options?: { global?: boolean }) => {
      await mm.setServerDisabled(name, disabled, options);
      return {
        statuses: mm.getServerStatuses(),
        skipped: mm.getSkippedServers(),
      };
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

  showModalOverlay(ctx.state.ui, selector, { widthPercent: 0.8, maxHeight: '70%' });
  selector.focused = true;
}

async function setDisabled(
  ctx: SlashCommandContext,
  disabled: boolean,
  target: string | undefined,
  global: boolean,
): Promise<void> {
  const mm = ctx.mcpManager;
  if (!mm) return;
  const verb = disabled ? 'disable' : 'enable';

  if (!target) {
    ctx.showInfo(`Usage: /mcp ${verb} <server-name|all> [--global]`);
    return;
  }

  const scopeSuffix = global ? ' --global' : '';
  const scopeLabel = global ? ' globally (all projects)' : '';

  if (target === 'all') {
    ctx.showInfo(`MCP: ${disabled ? 'Disabling' : 'Enabling'} all servers${scopeLabel}...`);
    await mm.setAllDisabled(disabled, { global });
    if (disabled) {
      ctx.showInfo(`MCP: All servers disabled${scopeLabel}. Re-enable with /mcp enable all${scopeSuffix}.`);
    } else {
      const statuses = mm.getServerStatuses();
      const connected = statuses.filter(s => s.connected);
      const totalTools = connected.reduce((sum, s) => sum + s.toolCount, 0);
      ctx.showInfo(
        `MCP: All servers enabled${scopeLabel}. ${connected.length} server(s) connected, ${totalTools} tool(s).`,
      );
      const stillDisabled = statuses.filter(s => s.disabled);
      if (!global && mm.isAllDisabledGlobally()) {
        ctx.showInfo('MCP: All MCP is still disabled globally — re-enable with /mcp enable all --global.');
      } else if (stillDisabled.length > 0) {
        const otherScope = global ? 'in this project' : 'globally';
        const otherSuffix = global ? '' : ' --global';
        ctx.showInfo(
          `MCP: Still disabled ${otherScope}: ${stillDisabled.map(s => s.name).join(', ')} — re-enable with /mcp enable <name|all>${otherSuffix}.`,
        );
      }
    }
    return;
  }

  ctx.showInfo(`MCP: ${disabled ? 'Disabling' : 'Enabling'} "${target}"${scopeLabel}...`);
  const status = await mm.setServerDisabled(target, disabled, { global });
  if (disabled) {
    if (status.disabled) {
      ctx.showInfo(`MCP: Disabled "${target}"${scopeLabel}. Re-enable with /mcp enable ${target}${scopeSuffix}.`);
    } else {
      ctx.showInfo(`MCP: Failed to disable "${target}": ${status.error ?? 'Unknown error'}`);
    }
  } else if (status.disabled) {
    // Removed from the requested scope, but something else still disables it.
    ctx.showInfo(
      mm.isAllDisabledGlobally()
        ? `MCP: "${target}" is still disabled — all MCP is disabled globally. Re-enable with /mcp enable all --global.`
        : status.disabledScope === 'global'
          ? `MCP: "${target}" is still disabled globally — re-enable with /mcp enable ${target} --global.`
          : `MCP: "${target}" is still disabled in this project — re-enable with /mcp enable ${target}.`,
    );
  } else if (status.connected) {
    ctx.showInfo(`MCP: Enabled "${target}" — ${status.toolCount} tool(s)`);
  } else if (status.needsAuth) {
    ctx.showInfo(`MCP: Enabled "${target}" — needs authentication \u2192 run /mcp to authenticate`);
  } else {
    ctx.showInfo(`MCP: Failed to enable "${target}": ${status.error ?? 'Unknown error'}`);
  }
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
    for (const s of statuses.filter(s => !s.connected && !s.disabled)) {
      if (s.needsAuth) {
        ctx.showInfo(`MCP: \u26a0 "${s.name}" needs authentication \u2192 run /mcp to authenticate`);
      } else {
        ctx.showInfo(`MCP: Failed to connect to "${s.name}": ${s.error}`);
      }
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

  if (mm.isAllDisabledGlobally()) {
    lines.push(`  \u2298 All MCP is disabled globally — re-enable via /mcp enable all --global`);
    lines.push('');
  }

  for (const status of statuses) {
    const icon = status.disabled
      ? '\u2298'
      : status.authenticating
        ? '\u26a0'
        : status.connecting
          ? '⟳'
          : status.connected
            ? '\u2713'
            : status.needsAuth
              ? '\u26a0'
              : '\u2717';
    const state = status.disabled
      ? status.disabledScope === 'global'
        ? `disabled globally — enable via /mcp enable ${status.name} --global`
        : `disabled — enable via /mcp enable ${status.name}`
      : status.authenticating
        ? 'authenticating — cancel via /mcp'
        : status.connecting
          ? 'connecting...'
          : status.connected
            ? 'connected'
            : status.needsAuth
              ? 'needs auth — authenticate via /mcp'
              : `error: ${status.error}`;
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
  lines.push(`  /mcp disable <name|all> [--global] - Disable server(s) for this project or globally (persists)`);
  lines.push(`  /mcp enable <name|all> [--global] - Re-enable disabled server(s)`);

  ctx.showInfo(lines.join('\n'));
}

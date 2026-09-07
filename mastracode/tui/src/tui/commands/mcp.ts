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

  // /mcp disable|enable <name|all> [--global] and /mcp inherit <name|all>
  if (subcommand === 'disable' || subcommand === 'enable') {
    const rest = args.slice(1);
    const global = rest.includes('--global') || rest.includes('-g');
    const target = rest.find(a => a !== '--global' && a !== '-g');
    await setDisabled(ctx, subcommand === 'disable', target, global);
    return;
  }
  if (subcommand === 'inherit') {
    await inheritServer(ctx, args[1]);
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
    onInheritServer: async (name: string) => {
      await mm.inheritServer(name);
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

  if (target === 'all') {
    const scopeLabel = global ? ' globally (all projects)' : ' in this project';
    ctx.showInfo(`MCP: ${disabled ? 'Disabling' : 'Enabling'} all servers${scopeLabel}...`);
    await mm.setAllDisabled(disabled, { global });
    if (disabled) {
      ctx.showInfo(
        global
          ? 'MCP: All servers disabled globally (all projects). Re-enable with /mcp enable all --global.'
          : 'MCP: All servers disabled in this project. Use /mcp inherit all to restore global defaults.',
      );
      return;
    }

    const statuses = mm.getServerStatuses();
    const connected = statuses.filter(s => s.connected);
    const totalTools = connected.reduce((sum, s) => sum + s.toolCount, 0);
    ctx.showInfo(
      global
        ? `MCP: Global defaults enabled. ${connected.length} server(s) connected, ${totalTools} tool(s).`
        : `MCP: All servers enabled in this project. ${connected.length} server(s) connected, ${totalTools} tool(s).`,
    );
    if (!global && mm.isAllDisabledGlobally()) {
      ctx.showInfo('MCP: The project overrides are saved, but all MCP is disabled by the global kill switch.');
    } else if (global) {
      const projectDisabled = statuses.filter(s => s.projectOverride === 'disabled');
      if (projectDisabled.length > 0) {
        ctx.showInfo(
          `MCP: Still disabled in this project: ${projectDisabled.map(s => s.name).join(', ')} — use /mcp inherit <name|all> or /mcp enable <name|all>.`,
        );
      }
    }
    return;
  }

  const status = await mm.setServerDisabled(target, disabled, { global });
  if (status.error && /not found/i.test(status.error)) {
    ctx.showInfo(`MCP: Failed to ${verb} "${target}": ${status.error}`);
    return;
  }

  if (global) {
    if (disabled) {
      ctx.showInfo(`MCP: Disabled "${target}" by default for all projects. Explicit project enables remain active.`);
    } else {
      ctx.showInfo(`MCP: Enabled "${target}" by default for all projects.`);
      if (status.projectOverride === 'disabled') {
        ctx.showInfo(`MCP: "${target}" is still disabled by this project's override.`);
      } else if (mm.isAllDisabledGlobally()) {
        ctx.showInfo('MCP: All MCP is still disabled by the global kill switch.');
      }
    }
    return;
  }

  if (disabled) {
    ctx.showInfo(
      `MCP: Disabled "${target}" in this project. Use /mcp inherit ${target} to restore the global default.`,
    );
  } else if (status.disabled) {
    ctx.showInfo(
      `MCP: Enabled "${target}" in this project, but all MCP is disabled by the global kill switch. The override is saved.`,
    );
  } else if (status.connected) {
    ctx.showInfo(`MCP: Enabled "${target}" in this project — ${status.toolCount} tool(s)`);
  } else if (status.needsAuth) {
    ctx.showInfo(`MCP: Enabled "${target}" in this project — needs authentication \u2192 run /mcp to authenticate`);
  } else {
    ctx.showInfo(
      `MCP: Enabled "${target}" in this project, but it failed to connect: ${status.error ?? 'Unknown error'}`,
    );
  }
}

async function inheritServer(ctx: SlashCommandContext, target: string | undefined): Promise<void> {
  const mm = ctx.mcpManager;
  if (!mm) return;
  if (!target) {
    ctx.showInfo('Usage: /mcp inherit <server-name|all>');
    return;
  }

  if (target === 'all') {
    await mm.inheritAllServers();
    const disabled = mm.getServerStatuses().filter(status => status.disabled);
    ctx.showInfo('MCP: Cleared all project overrides. Servers now inherit global defaults.');
    if (disabled.length > 0) {
      ctx.showInfo(`MCP: Disabled by global settings: ${disabled.map(status => status.name).join(', ')}.`);
    }
    return;
  }

  const status = await mm.inheritServer(target);
  if (status.error && /not found/i.test(status.error)) {
    ctx.showInfo(`MCP: Failed to inherit "${target}": ${status.error}`);
  } else if (status.disabled) {
    ctx.showInfo(`MCP: "${target}" now inherits its global default and is disabled.`);
  } else if (status.connected) {
    ctx.showInfo(`MCP: "${target}" now inherits its global default — ${status.toolCount} tool(s).`);
  } else if (status.needsAuth) {
    ctx.showInfo(`MCP: "${target}" now inherits its global default — needs authentication \u2192 run /mcp.`);
  } else {
    ctx.showInfo(
      `MCP: "${target}" now inherits its global default, but failed to connect: ${status.error ?? 'Unknown error'}`,
    );
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
    const overrideLabel = status.projectOverride ? `; project override: ${status.projectOverride}` : '';
    const state = status.disabled
      ? status.disabledScope === 'global'
        ? `disabled by global setting${overrideLabel} — override via /mcp enable ${status.name}`
        : `disabled in this project — use /mcp inherit ${status.name} to restore global default`
      : status.authenticating
        ? `authenticating${overrideLabel} — cancel via /mcp`
        : status.connecting
          ? `connecting${overrideLabel}...`
          : status.connected
            ? `connected${overrideLabel}`
            : status.needsAuth
              ? `needs auth${overrideLabel} — authenticate via /mcp`
              : `error: ${status.error}${overrideLabel}`;
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
  lines.push(`  /mcp disable <name|all> [--global] - Disable in this project or change the global default`);
  lines.push(`  /mcp enable <name|all> [--global] - Enable in this project or change the global default`);
  lines.push(`  /mcp inherit <name|all> - Clear project overrides and use global defaults`);

  ctx.showInfo(lines.join('\n'));
}

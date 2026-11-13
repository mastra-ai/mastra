import { loadCustomSlashCommands, refreshSkillsAutocomplete } from '../setup.js';
import type { SlashCommandContext } from './types.js';

/**
 * Reload everything Mastra Code reads from disk at startup: plugins, skills,
 * custom slash commands, hooks, and MCP servers.
 */
export async function handleReloadCommand(ctx: SlashCommandContext): Promise<void> {
  ctx.showInfo('Reloading plugins, skills, commands, hooks, and MCP servers...');
  const summary: string[] = [];
  const failures: string[] = [];
  const warnings: string[] = [];

  const step = async (label: string, run: () => Promise<string | undefined> | string | undefined) => {
    try {
      const result = await run();
      if (result) summary.push(result);
    } catch (error) {
      failures.push(`Reload failed (${label}): ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Plugins first: they contribute skill and command paths.
  await step('plugins', async () => {
    if (!ctx.pluginManager) return undefined;
    const plugins = await ctx.pluginManager.reload();
    return `${plugins.filter(plugin => plugin.status === 'active').length} plugin(s)`;
  });

  await step('skills', async () => {
    let workspace = ctx.getResolvedWorkspace();
    const local = ctx.state.local;
    if (!workspace && local?.controller.hasWorkspace()) {
      workspace = await local.controller.resolveWorkspace({ session: local.session });
    }
    await workspace?.skills?.refresh();
    await refreshSkillsAutocomplete(ctx.state);
    return `${ctx.state.skillCommands.length} skill(s)`;
  });

  await step('commands', async () => {
    await loadCustomSlashCommands(ctx.state);
    await refreshSkillsAutocomplete(ctx.state);
    return `${ctx.state.customSlashCommands.length} command(s)`;
  });

  await step('hooks', () => {
    if (!ctx.hookManager) return undefined;
    ctx.hookManager.reload();
    return 'hooks';
  });

  await step('mcp', async () => {
    const mm = ctx.mcpManager;
    if (!mm) return undefined;
    await mm.reload();
    const statuses = mm.getServerStatuses();
    const connected = statuses.filter(status => status.connected);
    const tools = connected.reduce((sum, status) => sum + status.toolCount, 0);
    for (const status of statuses.filter(s => !s.connected && !s.disabled)) {
      warnings.push(
        status.needsAuth
          ? `MCP: "${status.name}" needs authentication → run /mcp to authenticate`
          : `MCP: Failed to connect to "${status.name}": ${status.error ?? 'Unknown error'}`,
      );
    }
    return `${connected.length} MCP server(s), ${tools} MCP tool(s)`;
  });

  ctx.showInfo(`Reloaded: ${summary.join(', ')}.`);
  for (const warning of warnings) ctx.showInfo(warning);
  for (const failure of failures) ctx.showError(failure);
}

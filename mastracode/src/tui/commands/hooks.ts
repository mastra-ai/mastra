import type { SlashCommandContext } from './types.js';

export function handleHooksCommand(ctx: SlashCommandContext, args: string[]): void {
  const hm = ctx.hookManager;
  if (!hm) {
    ctx.showInfo('Hooks system not initialized.');
    return;
  }

  const subcommand = args[0];
  if (subcommand === 'reload') {
    hm.reload();
    ctx.showInfo('Hooks config reloaded.');
    return;
  }

  const paths = hm.getConfigPaths();

  if (!hm.hasHooks()) {
    ctx.showInfo(
      `No hooks configured.\n\n` +
        `Add hooks to:\n` +
        `  ${paths.project} (project)\n` +
        `  ${paths.global} (global)\n\n` +
        `Example hooks.json:\n` +
        `  {\n` +
        `    "PreToolUse": [{\n` +
        `      "type": "command",\n` +
        `      "command": "echo 'tool called'",\n` +
        `      "matcher": { "tool_name": "execute_command" }\n` +
        `    }]\n` +
        `  }`,
    );
    return;
  }

  const hookConfig = hm.getConfig();
  const lines: string[] = [`Hooks Configuration:`];
  lines.push(`  Project: ${paths.project}`);
  lines.push(`  Global:  ${paths.global}`);
  lines.push('');

  const eventNames = ['PreToolUse', 'PostToolUse', 'Stop', 'UserPromptSubmit', 'SessionStart', 'SessionEnd'] as const;

  for (const event of eventNames) {
    const hooks = hookConfig[event];
    if (hooks && hooks.length > 0) {
      lines.push(`  ${event} (${hooks.length} hook${hooks.length > 1 ? 's' : ''}):`);
      for (const hook of hooks) {
        const matcherStr = hook.matcher?.tool_name ? ` [tool: ${hook.matcher.tool_name}]` : '';
        const desc = hook.description ? ` - ${hook.description}` : '';
        lines.push(`    ${hook.command}${matcherStr}${desc}`);
      }
    }
  }

  lines.push('');
  lines.push(`  /hooks reload - Reload config from disk`);

  ctx.showInfo(lines.join('\n'));
}

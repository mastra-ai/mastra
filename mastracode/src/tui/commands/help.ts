import type { SlashCommandContext } from './types.js';

export function handleHelpCommand(ctx: SlashCommandContext): void {
  const modes = ctx.harness.listModes();
  const modeHelp = modes.length > 1 ? '\n/mode     - Switch or list modes' : '';

  let customCommandsHelp = '';
  if (ctx.customSlashCommands.length > 0) {
    customCommandsHelp =
      '\n\nCustom commands (use // prefix):\n' +
      ctx.customSlashCommands
        .map(cmd => `  //${cmd.name.padEnd(8)} - ${cmd.description || 'No description'}`)
        .join('\n');
  }

  ctx.showInfo(`Available commands:
  /new       - Start a new thread
  /threads       - Switch between threads
  /thread:tag-dir - Tag thread with current directory
  /name          - Rename current thread
  /resource      - Show/switch resource ID (tag for sharing)
  /skills        - List available skills
  /models    - Configure model (global/thread/mode)
  /subagents - Configure subagent model defaults
  /permissions - View/manage tool approval permissions
  /settings - General settings (notifications, YOLO, thinking)
  /om       - Configure Observational Memory
  /review   - Review a GitHub pull request
  /cost     - Show token usage and estimated costs
  /diff     - Show modified files or git diff for a path
  /sandbox  - Manage sandbox allowed paths
  /hooks    - Show/reload configured hooks
  /mcp      - Show/reload MCP server connections
  /login    - Login with OAuth provider
  /logout   - Logout from OAuth provider${modeHelp}
  /exit     - Exit the TUI
  /help     - Show this help${customCommandsHelp}

Shell:
  !<cmd>    - Run a shell command directly (e.g., !ls -la)

Keyboard shortcuts:
  Ctrl+C    - Interrupt agent / clear input
  Ctrl+C×2  - Exit process (double-tap)
  Ctrl+D    - Exit (when editor is empty)
  Enter     - While working: steer (interrupt + redirect)
  Ctrl+F    - While working: queue follow-up message
  Shift+Tab - Cycle agent modes
  Ctrl+T    - Toggle thinking blocks
  Ctrl+E    - Expand/collapse tool outputs`);
}

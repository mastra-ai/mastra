import { theme } from '../theme.js';
import type { SlashCommandContext } from './types.js';

/**
 * /quorem [subcommand] — Manage quorem parallel agent sessions.
 *
 * Subcommands:
 *   (none)  — Show current quorem session status
 *   view <agentId> — Switch TUI view to a quorem agent's thread
 *   back — Return to the main agent's thread view
 *   cancel — Cancel the active quorem session
 */
export async function handleQuoremCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const sub = args[0];

  if (!sub) {
    return showQuoremStatus(ctx);
  }

  switch (sub) {
    case 'view':
      return handleQuoremView(ctx, args[1]);
    case 'back':
      return handleQuoremBack(ctx);
    case 'cancel':
      return handleQuoremCancel(ctx);
    default:
      ctx.showError(`Unknown /quorem subcommand: ${sub}. Use view, back, or cancel.`);
  }
}

function showQuoremStatus(ctx: SlashCommandContext): void {
  const ds = ctx.state.harness.getDisplayState();
  const session = ds.activeQuoremSession;

  if (!session) {
    ctx.showInfo('No active quorem session.');
    return;
  }

  const lines: string[] = [
    `${theme.fg('accent', 'Quorem Session')} ${theme.fg('muted', `(${session.id})`)}`,
    `Task: ${session.task}`,
    `Status: ${session.status}`,
    '',
  ];

  for (const agent of session.agents) {
    const statusColor = agent.status === 'completed' ? 'success' : agent.status === 'error' ? 'error' : 'muted';
    const label = agent.label || agent.id;
    lines.push(
      `  ${theme.fg(statusColor as any, `[${agent.status}]`)} ${label}` +
        (agent.modelId ? ` ${theme.fg('muted', `(${agent.modelId})`)}` : ''),
    );
    if (agent.summary) {
      lines.push(`    ${theme.fg('muted', agent.summary)}`);
    }
  }

  lines.push('');
  lines.push(theme.fg('muted', 'Use /quorem view <id> to view an agent, /quorem cancel to abort.'));

  ctx.showInfo(lines.join('\n'));
}

function handleQuoremView(ctx: SlashCommandContext, agentId?: string): void {
  if (!agentId) {
    ctx.showError('Usage: /quorem view <agentId>');
    return;
  }

  const ds = ctx.state.harness.getDisplayState();
  const session = ds.activeQuoremSession;

  if (!session) {
    ctx.showError('No active quorem session.');
    return;
  }

  const agent = session.agents.find(a => a.id === agentId);
  if (!agent) {
    const ids = session.agents.map(a => a.id).join(', ');
    ctx.showError(`Agent "${agentId}" not found. Available: ${ids}`);
    return;
  }

  ctx.state.viewingQuoremAgentId = agentId;
  ctx.showInfo(`Viewing quorem agent: ${agent.label || agentId}. Use /quorem back to return.`);
}

function handleQuoremBack(ctx: SlashCommandContext): void {
  if (!ctx.state.viewingQuoremAgentId) {
    ctx.showInfo('Already viewing the main thread.');
    return;
  }

  ctx.state.viewingQuoremAgentId = undefined;
  ctx.showInfo('Returned to main thread view.');
}

async function handleQuoremCancel(ctx: SlashCommandContext): Promise<void> {
  try {
    await ctx.state.harness.cancelQuoremSession();
    ctx.state.viewingQuoremAgentId = undefined;
    ctx.showInfo('Quorem session cancelled.');
  } catch (err) {
    ctx.showError(`Failed to cancel quorem session: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Quorem session status component.
 * Shows a persistent, compact display of all quorem agents and their statuses.
 * Renders similarly to task-progress — hidden when no quorem session is active.
 */
import { Container, Text, Spacer } from '@mariozechner/pi-tui';
import type { QuoremAgentState, QuoremSession } from '@mastra/core/harness';
import { theme } from '../theme.js';

export class QuoremStatusComponent extends Container {
  private session: QuoremSession | null = null;

  constructor() {
    super();
  }

  updateSession(session: QuoremSession | null): void {
    this.session = session;
    this.rebuild();
  }

  private rebuild(): void {
    this.clear();

    if (!this.session || this.session.status === 'merged' || this.session.status === 'cancelled') {
      return;
    }

    const { session } = this;
    const completed = session.agents.filter(a => a.status === 'completed' || a.status === 'error').length;
    const total = session.agents.length;

    this.addChild(new Spacer(1));

    const statusLabel =
      session.status === 'reviewing'
        ? theme.fg('warning' as any, 'reviewing')
        : theme.fg('muted', session.status);

    const header =
      '  ' +
      theme.bold(theme.fg('accent', 'Quorem')) +
      theme.fg('dim', ` [${completed}/${total} done]`) +
      ' ' +
      statusLabel;

    this.addChild(new Text(header, 0, 0));

    // Show task summary
    const taskLine = '    ' + theme.fg('muted', session.task.length > 80 ? session.task.slice(0, 77) + '...' : session.task);
    this.addChild(new Text(taskLine, 0, 0));

    // Show each agent
    for (const agent of session.agents) {
      this.addChild(new Text(this.formatAgentLine(agent), 0, 0));
    }

    this.invalidate();
  }

  private formatAgentLine(agent: QuoremAgentState): string {
    const indent = '    ';
    const icon = statusIcon(agent.status);
    const label = agent.label || agent.id;
    const model = agent.modelId ? theme.fg('muted', ` (${agent.modelId})`) : '';
    const duration =
      agent.durationMs != null ? theme.fg('muted', ` ${formatDuration(agent.durationMs)}`) : '';

    return `${indent}${icon} ${label}${model}${duration}`;
  }
}

function statusIcon(status: QuoremAgentState['status']): string {
  switch (status) {
    case 'pending':
      return theme.fg('muted', '○');
    case 'running':
      return theme.fg('accent', '⋯');
    case 'completed':
      return theme.fg('success', '✓');
    case 'error':
      return theme.fg('error', '✗');
    default:
      return theme.fg('muted', '?');
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = (ms / 1000).toFixed(1);
  return `${s}s`;
}

/**
 * Header banner shown when the user is viewing a quorem agent's thread.
 * Provides context about which agent is being viewed and how to return.
 */
import { Container, Text, Spacer } from '@mariozechner/pi-tui';
import type { QuoremAgentState } from '@mastra/core/harness';
import { theme } from '../theme.js';

export class QuoremAgentHeaderComponent extends Container {
  constructor(agent: QuoremAgentState) {
    super();

    const label = agent.label || agent.id;
    const statusIcon =
      agent.status === 'completed'
        ? theme.fg('success', '✓')
        : agent.status === 'error'
          ? theme.fg('error', '✗')
          : agent.status === 'running'
            ? theme.fg('accent', '⋯')
            : theme.fg('muted', '○');

    const model = agent.modelId ? theme.fg('muted', ` · ${agent.modelId}`) : '';
    const headerLine =
      theme.bold(theme.fg('accent', `  ◆ Quorem Agent: ${label}`)) +
      ` ${statusIcon}` +
      model;

    this.addChild(new Spacer(1));
    this.addChild(new Text(headerLine, 0, 0));
    this.addChild(new Text(theme.fg('muted', '  Use /quorem back to return to the main thread.'), 0, 0));
    this.addChild(new Spacer(1));
  }
}

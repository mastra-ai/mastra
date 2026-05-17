import { Container } from '@mariozechner/pi-tui';
import type { Component } from '@mariozechner/pi-tui';
import { describe, expect, it } from 'vitest';
import { reconcileChatBoundarySpacers } from '../../chat-boundary-reconciliation.js';
import { AssistantMessageComponent } from '../assistant-message.js';
import { PlanApprovalInlineComponent } from '../plan-approval-inline.js';
import { ToolExecutionComponentEnhanced } from '../tool-execution-enhanced.js';
import { UserMessageComponent } from '../user-message.js';

const ui = { requestRender() {} } as any;

function renderSequence(components: Component[]): string[] {
  const container = new Container();
  components.forEach(component => container.addChild(component));
  reconcileChatBoundarySpacers(container);
  return container.render(100);
}

function quietTool(name = 'view'): ToolExecutionComponentEnhanced {
  return new ToolExecutionComponentEnhanced(name, { path: 'src/example.ts', command: 'echo hi' }, { quietDisplayMode: 'quiet' }, ui);
}

function assistant(text = 'assistant text'): AssistantMessageComponent {
  return new AssistantMessageComponent({ id: 'a', role: 'assistant', content: [{ type: 'text', text }] } as any);
}

describe('ChatBoundarySpacer', () => {
  it('renders no blank line between adjacent quiet compact tools', () => {
    const lines = renderSequence([quietTool('view'), quietTool('string_replace_lsp')]);
    expect(lines).not.toContain('');
  });

  it('renders one blank line between a quiet compact tool and quiet shell tool', () => {
    const lines = renderSequence([quietTool('view'), quietTool('execute_command')]);
    expect(lines.filter(line => line === '')).toHaveLength(1);
  });

  it('renders one blank line between a quiet shell tool and quiet compact tool', () => {
    const lines = renderSequence([quietTool('execute_command'), quietTool('view')]);
    expect(lines.filter(line => line === '')).toHaveLength(1);
  });

  it('renders one blank line between a quiet tool run and assistant text', () => {
    const lines = renderSequence([quietTool('view'), quietTool('string_replace_lsp'), assistant()]);
    expect(lines.filter(line => line === '')).toHaveLength(1);
  });

  it('renders one blank line between user message and assistant text', () => {
    const lines = renderSequence([new UserMessageComponent('hello'), assistant()]);
    expect(lines.filter(line => line === '')).toHaveLength(1);
  });

  it('renders one blank line between quiet compact tool and user message', () => {
    const lines = renderSequence([quietTool('view'), new UserMessageComponent('hello')]);
    expect(lines.filter(line => line === '')).toHaveLength(1);
  });

  it('keeps plan components full size and separated normally', () => {
    const plan = PlanApprovalInlineComponent.createStreaming(ui);
    plan.updateArgs({ title: 'Test plan', plan: '## Step one\nDo the thing.' });
    const lines = renderSequence([quietTool('view'), plan]);

    expect(lines.join('\n')).toContain('Plan: Test plan');
    expect(lines.join('\n')).toContain('Step one');
    expect(lines.filter(line => line === '')).toHaveLength(1);
  });
});

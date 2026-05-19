import { Container } from '@mariozechner/pi-tui';
import type { Component } from '@mariozechner/pi-tui';
import { describe, expect, it } from 'vitest';
import {
  insertChatComponentWithBoundarySpacing,
  reconcileChatBoundarySpacers,
} from '../../chat-boundary-reconciliation.js';
import { AssistantMessageComponent } from '../assistant-message.js';
import { PlanApprovalInlineComponent } from '../plan-approval-inline.js';
import { ToolExecutionComponentEnhanced } from '../tool-execution-enhanced.js';
import { UserMessageComponent } from '../user-message.js';

const ui = { requestRender() {} } as any;

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

function renderSequence(components: Component[]): string[] {
  const container = new Container();
  components.forEach(component => container.addChild(component));
  reconcileChatBoundarySpacers(container);
  return container.render(100);
}

function quietTool(name = 'view'): ToolExecutionComponentEnhanced {
  const component = new ToolExecutionComponentEnhanced(
    name,
    { path: 'src/example.ts', command: 'echo hi' },
    { quietDisplayMode: 'quiet' },
    ui,
  );
  component.updateResult({ content: [{ type: 'text', text: 'done' }], isError: false });
  return component;
}

function completeTool(component: ToolExecutionComponentEnhanced): ToolExecutionComponentEnhanced {
  component.updateResult({ content: [{ type: 'text', text: 'done' }], isError: false });
  return component;
}

function assistant(text = 'assistant text'): AssistantMessageComponent {
  return new AssistantMessageComponent({ id: 'a', role: 'assistant', content: [{ type: 'text', text }] } as any);
}

describe('ChatBoundarySpacer', () => {
  it('inserts boundary spacing together with live components', () => {
    const container = new Container();
    insertChatComponentWithBoundarySpacing(container, quietTool('view'));
    insertChatComponentWithBoundarySpacing(container, assistant());

    expect(container.render(100).filter(line => line === '')).toHaveLength(1);
  });

  it('spaces unrelated singleton tool changes across empty streaming message placeholders', () => {
    const container = new Container();
    insertChatComponentWithBoundarySpacing(container, quietTool('view'));
    insertChatComponentWithBoundarySpacing(container, new AssistantMessageComponent());
    insertChatComponentWithBoundarySpacing(container, quietTool('string_replace_lsp'));

    expect(container.render(100).filter(line => line === '')).toHaveLength(1);
  });

  it('renders no blank line between adjacent quiet compact tools with the same tool name', () => {
    const lines = renderSequence([quietTool('view'), quietTool('view')]);
    expect(lines).not.toContain('');
  });

  it('renders one blank line between unrelated sibling quiet compact tools', () => {
    const lines = renderSequence([
      quietTool('view'),
      quietTool('string_replace_lsp'),
      quietTool('view'),
      quietTool('string_replace_lsp'),
    ]);
    expect(lines.filter(line => line === '')).toHaveLength(3);
  });

  it('renders blank lines around repeated quiet compact tool runs', () => {
    const lines = renderSequence([
      quietTool('view'),
      quietTool('string_replace_lsp'),
      quietTool('string_replace_lsp'),
      quietTool('string_replace_lsp'),
      quietTool('view'),
      quietTool('string_replace_lsp'),
    ]);
    expect(lines.filter(line => line === '')).toHaveLength(3);
  });

  it('keeps the visible grouped tool label orange unless a continuation fails', () => {
    const first = new ToolExecutionComponentEnhanced(
      'view',
      { path: 'src/example.ts' },
      { quietDisplayMode: 'quiet' },
      ui,
    );
    const second = completeTool(
      new ToolExecutionComponentEnhanced(
        'view',
        { path: 'src/example.ts', offset: 1, limit: 1 },
        { quietDisplayMode: 'quiet' },
        ui,
      ),
    );

    let lines = renderSequence([first, second]);
    expect(lines[0]).toContain('view');

    second.updateResult({ content: [{ type: 'text', text: 'failed' }], isError: true });
    lines = renderSequence([first, second]);
    expect(lines[0]).toContain('view');
  });

  it('groups adjacent quiet compact tools of the same type and blanks shared prefixes', () => {
    const lines = renderSequence([
      completeTool(
        new ToolExecutionComponentEnhanced(
          'view',
          { path: 'mastracode/src/tui/components/tool-execution-enhanced.ts', offset: 301, limit: 84 },
          { quietDisplayMode: 'quiet' },
          ui,
        ),
      ),
      completeTool(
        new ToolExecutionComponentEnhanced(
          'view',
          { path: 'mastracode/src/tui/chat-boundary-reconciliation.ts', offset: 1, limit: 45 },
          { quietDisplayMode: 'quiet' },
          ui,
        ),
      ),
      completeTool(
        new ToolExecutionComponentEnhanced(
          'view',
          { path: 'mastracode/src/tui/chat-boundary-reconciliation.ts', offset: 50, limit: 10 },
          { quietDisplayMode: 'quiet' },
          ui,
        ),
      ),
    ]);

    expect(lines).not.toContain('');
    expect(stripAnsi(lines[0]!)).toContain('▐view▌mastracode/src/tui/components/tool-execution-enhanced.ts:301-384');
    expect(stripAnsi(lines[1]!)).not.toContain('view');
    expect(stripAnsi(lines[1]!)).toContain('/tui/chat-boundary-reconciliation.ts:1-45');
    expect(stripAnsi(lines[2]!)).toContain('/tui/chat-boundary-reconciliation.ts:50-59');
  });

  it('renders one blank line between a quiet compact tool and quiet shell tool', () => {
    const lines = renderSequence([quietTool('view'), quietTool('execute_command')]);
    expect(lines.filter(line => line === '')).toHaveLength(1);
  });

  it('renders one blank line between a quiet shell tool and quiet compact tool', () => {
    const lines = renderSequence([quietTool('execute_command'), quietTool('view')]);
    expect(lines.filter(line => line === '')).toHaveLength(1);
  });

  it('renders one blank line between a same-tool quiet run and assistant text', () => {
    const lines = renderSequence([quietTool('view'), quietTool('view'), assistant()]);
    expect(lines.filter(line => line === '')).toHaveLength(1);
  });

  it('renders one blank line between assistant text and a quiet tool', () => {
    const lines = renderSequence([assistant(), quietTool('view')]);
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

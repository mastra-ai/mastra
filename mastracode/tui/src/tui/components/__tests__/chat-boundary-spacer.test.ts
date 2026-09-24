import { Container, visibleWidth } from '@earendil-works/pi-tui';
import type { Component } from '@earendil-works/pi-tui';
import { describe, expect, it, vi } from 'vitest';
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
  return new AssistantMessageComponent({
    id: 'a',
    role: 'assistant',
    content: { format: 2, parts: [{ type: 'text', text }] },
  } as any);
}

describe('ChatBoundarySpacer', () => {
  it('inserts boundary spacing together with live components', () => {
    const container = new Container();
    insertChatComponentWithBoundarySpacing(container, quietTool('view'));
    insertChatComponentWithBoundarySpacing(container, assistant());

    expect(container.render(100).filter(line => line === '')).toHaveLength(1);
  });

  it('preserves completed component caches across boundary reconciliation', () => {
    const container = new Container();
    const first = assistant('stable assistant text');
    const second = quietTool('view');
    const firstInvalidate = vi.spyOn(first, 'invalidate');
    const secondInvalidate = vi.spyOn(second, 'invalidate');

    container.addChild(first);
    container.addChild(second);
    reconcileChatBoundarySpacers(container);
    const initialLines = container.render(100);
    reconcileChatBoundarySpacers(container);

    expect(container.render(100)).toEqual(initialLines);
    expect(firstInvalidate).not.toHaveBeenCalled();
    expect(secondInvalidate).not.toHaveBeenCalled();
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
    plan.updateArgs({ path: '.mastracode/plans/test-plan.md' });
    const lines = renderSequence([quietTool('view'), plan]);

    expect(lines.join('\n')).toContain('Plan: Untitled plan');
    expect(lines.join('\n')).toContain('.mastracode/plans/test-plan.md');
    expect(lines.filter(line => line === '')).toHaveLength(1);
  });
  it('leaves Thinking out of the chat and groups described shell calls into one box in quiet mode', () => {
    const thinking = () => {
      const component = new AssistantMessageComponent(
        {
          id: 'a',
          role: 'assistant',
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'reasoning', reasoning: 'hmm' }] },
        } as never,
        true,
      );
      component.setQuietModeDisplay('quiet');
      return component;
    };
    const shell = (description: string) => {
      const component = new ToolExecutionComponentEnhanced(
        'execute_command',
        { command: 'git log', description, cwd: '/tmp/work' },
        { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 0 },
        ui,
      );
      component.updateResult({ content: [{ type: 'text', text: 'out' }], isError: false }, false);
      return component;
    };

    const lines = renderSequence([
      thinking(),
      shell('Listing later commits'),
      thinking(),
      shell('Searching for stdin changes'),
      shell('Reading changesets'),
      thinking(),
    ]).map(line => stripAnsi(line).trimEnd());

    expect(lines).toEqual([
      expect.stringMatching(/^╭─+╮$/),
      expect.stringMatching(/^│ \$ \/tmp\/work +│$/),
      expect.stringMatching(/^├─+┤$/),
      expect.stringMatching(/^│ ✓ Listing later commits +\d+ms │$/),
      expect.stringMatching(/^│ ✓ Searching for stdin changes +\d+ms │$/),
      expect.stringMatching(/^│ ✓ Reading changesets +\d+ms │$/),
      expect.stringMatching(/^╰─+╯$/),
    ]);
  });
  it('sizes a quiet shell box to its widest row, between a narrow default and the full width', () => {
    const shell = (description: string) => {
      const component = new ToolExecutionComponentEnhanced(
        'execute_command',
        { command: 'x', description, cwd: '/tmp/w' },
        { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 0 },
        ui,
      );
      component.updateResult({ content: [{ type: 'text', text: 'ok' }], isError: false }, false);
      return component;
    };
    const boxWidths = (descriptions: string[], width = 140) => {
      const container = new Container();
      descriptions.forEach(description => container.addChild(shell(description)));
      reconcileChatBoundarySpacers(container);
      return new Set(container.render(width).map(line => visibleWidth(line.trimEnd())));
    };

    // Short rows get the narrow default: 76 content columns + "│ " + " │"
    expect(boxWidths(['Reading changelog', 'Pulling notes'])).toEqual(new Set([80]));

    // One long row widens every row of the shared box to match it
    const long = 'Comparing every stable mastracode release note against the unreleased changesets in main';
    expect(boxWidths(['Reading changelog', long])).toEqual(new Set([long.length + 2 + 1 + 'started'.length + 4]));

    // Never wider than the terminal allows
    const [full] = boxWidths([long.repeat(3)], 100);
    expect(full).toBeLessThanOrEqual(100);
    expect(boxWidths([long.repeat(3)], 100).size).toBe(1);
  });
  it('keeps one box width across hidden quiet Thinking messages between shell calls', () => {
    const thinking = () => {
      const component = new AssistantMessageComponent(
        {
          id: 'a',
          role: 'assistant',
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'reasoning', reasoning: 'hmm' }] },
        } as never,
        true,
      );
      component.setQuietModeDisplay('quiet');
      return component;
    };
    const shell = (description: string) => {
      const component = new ToolExecutionComponentEnhanced(
        'execute_command',
        { command: 'x', description, cwd: '/tmp/w' },
        { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 0 },
        ui,
      );
      component.updateResult({ content: [{ type: 'text', text: 'ok' }], isError: false }, false);
      return component;
    };

    const container = new Container();
    for (const description of [
      'Listing later commits touching sandbox/command code',
      'Searching for stdin changes and their releases',
      'Reading changesets of related commits',
    ]) {
      container.addChild(thinking());
      container.addChild(shell(description));
    }
    reconcileChatBoundarySpacers(container);

    const widths = new Set(container.render(140).map(line => visibleWidth(line.trimEnd())));
    expect(widths.size).toBe(1);
  });

  it('holds a streaming shell call below a shell box until its directory arrives, so lines are only added', () => {
    const make = (args: Record<string, unknown>) =>
      new ToolExecutionComponentEnhanced(
        'execute_command',
        args,
        { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 0 },
        ui,
      );
    const done = make({ command: 'cd /tmp && gh api graphql', description: 'Reading PR reviews' });
    done.updateResult({ content: [{ type: 'text', text: 'ok' }], isError: false }, false);
    const streaming = make({});
    streaming.setArgsStreaming(true);

    const container = new Container();
    container.addChild(done);
    container.addChild(streaming);
    const render = () => {
      reconcileChatBoundarySpacers(container);
      return container.render(120).map(line => stripAnsi(line).trimEnd());
    };

    const beforeCall = render();
    // The description streams in before the "cd /tmp &&" that sets the directory
    streaming.updateArgs({ description: 'Listing unresolved threads' }, false);
    expect(render()).toEqual(beforeCall);
    streaming.updateArgs({ description: 'Listing unresolved threads', command: 'cd /t' }, false);
    expect(render()).toEqual(beforeCall);

    streaming.updateArgs(
      { description: 'Listing unresolved threads', command: 'cd /tmp && gh api graphql -f query=x' },
      false,
    );
    const joined = render();
    expect(joined).toHaveLength(beforeCall.length + 1);
    expect(joined.slice(0, -2)).toEqual(beforeCall.slice(0, -1));
    expect(joined.filter(line => line.includes('$ /tmp'))).toHaveLength(1);
    expect(joined.some(line => line.includes('Listing unresolved threads'))).toBe(true);
    streaming.setArgsStreaming(false);
    expect(render()).toHaveLength(joined.length);

    // Without a shell box above, it opens its own box and fills in the directory later
    const alone = new Container();
    const first = make({ description: 'Listing files' });
    first.setArgsStreaming(true);
    alone.addChild(first);
    reconcileChatBoundarySpacers(alone);
    const before = alone.render(120).length;
    first.updateArgs({ description: 'Listing files', command: 'cd /tmp && ls' });
    first.setArgsStreaming(false);
    reconcileChatBoundarySpacers(alone);
    const after = alone.render(120).map(line => stripAnsi(line).trimEnd());
    expect(after).toHaveLength(before);
    expect(after.some(line => line.includes('$ /tmp'))).toBe(true);
  });

  it('opens a command-first call in its own directory box once the cd prefix arrives, never moving it', () => {
    const make = (args: Record<string, unknown>) =>
      new ToolExecutionComponentEnhanced(
        'execute_command',
        args,
        { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 0 },
        ui,
      );
    const root = make({ command: 'sed -n 1,5p file.ts', description: 'Reading the processor block' });
    root.updateResult({ content: [{ type: 'text', text: 'ok' }], isError: false }, false);
    const streaming = make({});
    streaming.setArgsStreaming(true);
    const container = new Container();
    container.addChild(root);
    container.addChild(streaming);
    const render = () => {
      reconcileChatBoundarySpacers(container);
      return container.render(120).map(line => stripAnsi(line).trimEnd());
    };

    const beforeCall = render();
    // Some models write a long command before its description
    streaming.updateArgs({ command: 'cd /tm' }, false);
    expect(render()).toEqual(beforeCall);
    streaming.updateArgs({ command: "cd /tmp && python3 - <<'PYEOF'\n" + 'x = 1\n'.repeat(400) }, false);
    const whileStreaming = render();
    // The root box stays exactly as it was; the new box is only added below it
    expect(whileStreaming.slice(0, beforeCall.length)).toEqual(beforeCall);
    expect(whileStreaming.filter(line => line.startsWith('╭'))).toHaveLength(2);
    expect(whileStreaming.some(line => line.includes('$ /tmp'))).toBe(true);
    expect(whileStreaming.some(line => /writing command \(2\.4k chars\)/.test(line))).toBe(true);
    expect(whileStreaming.join('\n')).not.toMatch(/python3|\.\.\./);

    streaming.updateArgs(
      { command: "cd /tmp && python3 - <<'PYEOF'\n" + 'x = 1\n'.repeat(400), description: 'Rewriting the PR body' },
      false,
    );
    const described = render();
    expect(described).toHaveLength(whileStreaming.length);
    expect(described.some(line => line.includes('Rewriting the PR body'))).toBe(true);
    streaming.stopLiveUpdates();

    // A command that doesn't start with cd joins the box above as soon as that is clear
    const plain = make({});
    plain.setArgsStreaming(true);
    const rootOnly = new Container();
    rootOnly.addChild(root);
    rootOnly.addChild(plain);
    const renderRoot = () => {
      reconcileChatBoundarySpacers(rootOnly);
      return rootOnly.render(120).map(line => stripAnsi(line).trimEnd());
    };
    const beforePlain = renderRoot();
    plain.updateArgs({ command: 'c' }, false);
    expect(renderRoot()).toEqual(beforePlain);
    plain.updateArgs({ command: 'cat file.ts' }, false);
    const withPlain = renderRoot();
    expect(withPlain).toHaveLength(beforePlain.length + 1);
    expect(withPlain.filter(line => line.startsWith('╭'))).toHaveLength(1);
    plain.stopLiveUpdates();
  });
});

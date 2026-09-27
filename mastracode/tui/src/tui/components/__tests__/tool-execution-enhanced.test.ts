import { homedir } from 'node:os';
import { dirname } from 'node:path';
import { Container, visibleWidth } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { describe, it, expect, vi } from 'vitest';
import { reconcileChatBoundarySpacers } from '../../chat-boundary-reconciliation.js';
import { theme, tintHex, ensureTerminalGlyphContrast } from '../../theme.js';
import { getSpacingBetweenComponents } from '../chat-spacing.js';
import { ToolExecutionComponentEnhanced, parseErrorFromContent } from '../tool-execution-enhanced.js';

const ui = { requestRender() {} } as any;

function stripAnsi(text: string): string {
  return text
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\u001b\]8;;[^\u0007]*\u0007/g, '')
    .replace(/\u001b\]8;;\u0007/g, '');
}

/** Renders components as the chat does, so quiet shell calls get their shared box state. */
function renderInChat(components: ToolExecutionComponentEnhanced[], width = 80): string[] {
  const container = new Container();
  components.forEach(component => container.addChild(component));
  reconcileChatBoundarySpacers(container);
  return stripAnsi(container.render(width).join('\n'))
    .split('\n')
    .map(line => line.trimEnd());
}

describe('completed shell/process background status', () => {
  it.each(['execute_command', 'get_process_output', 'kill_process'])(
    '%s preserves terminal background badges',
    toolName => {
      for (const isError of [false, true]) {
        const component = new ToolExecutionComponentEnhanced(toolName, { command: 'echo done', pid: '123' }, {}, ui);
        component.setBackgroundTaskId('shell-task');
        component.updateResult({ content: [{ type: 'text', text: 'done' }], isError });
        expect(stripAnsi(component.render(120).join('\n'))).toContain(`${isError ? '✗' : '✓'} background · shell-task`);
        component.cancelBackground();
        expect(stripAnsi(component.render(120).join('\n'))).toContain('■ background · shell-task');
      }
    },
  );

  it('marks nonzero shell exits as failed with and without background identity', () => {
    for (const background of [false, true]) {
      const component = new ToolExecutionComponentEnhanced('execute_command', { command: 'example' }, {}, ui);
      if (background) component.setBackgroundTaskId('shell-task');
      component.updateResult({ content: [{ type: 'text', text: 'Error: failed\n\nExit code: 1' }], isError: false });
      const output = stripAnsi(component.render(120).join('\n'));
      expect(output).toContain(background ? '✗ background · shell-task' : '✗');
      if (!background) expect(output).not.toContain('background');
    }
  });

  it('does not treat error-looking output from a successful command as a failure', () => {
    const component = new ToolExecutionComponentEnhanced('execute_command', { command: 'grep -n error src' }, {}, ui);
    component.updateResult({ content: [{ type: 'text', text: '12:  ? { error: envelope.error }' }], isError: false });
    const output = stripAnsi(component.render(120).join('\n'));
    expect(output).toContain('✓');
    expect(output).not.toContain('✗');
  });
});

describe('agent_signal_send rendering', () => {
  const args = {
    targetId: 'code-agent:resource-2:thread-2',
    message: ['Please review the auth refactor.', 'Focus on session renewal.', 'Report any blocking issues.'].join(
      '\n',
    ),
    priority: 'high',
    expectsReply: true,
  };

  it('shows the full sent message and routing outcome', () => {
    const component = new ToolExecutionComponentEnhanced('agent_signal_send', args, {}, ui);
    component.updateResult({
      content: [{ type: 'text', text: 'Delivered high signal to "Peer Reviewer" in run run-1' }],
      isError: false,
    });

    const visible = stripAnsi(component.render(80).join('\n'));
    expect(visible).toContain('target:');
    expect(visible).toContain(args.targetId);
    expect(visible).toContain('priority: high');
    expect(visible).toContain('expects reply: yes');
    expect(visible).toContain('Please review the auth refactor.');
    expect(visible).toContain('Focus on session renewal.');
    expect(visible).toContain('Report any blocking issues.');
    expect(visible).toContain('Delivered high signal to "Peer Reviewer" in run run-1');
  });

  it.each([
    ['standard', {}],
    ['quiet', { quietDisplayMode: 'quiet' as const, quietPreviewLineLimit: 20, collapsedByDefault: true }],
  ])('preserves paragraphs and grapheme clusters in %s mode', (mode, options) => {
    const message = `First paragraph.\n\n${'👩‍💻'.repeat(40)}`;
    const component = new ToolExecutionComponentEnhanced('agent_signal_send', { ...args, message }, options, ui);
    component.updateResult({
      content: [{ type: 'text', text: 'Delivered high signal to "Peer Reviewer" in run run-1' }],
      isError: false,
    });

    const lines = stripAnsi(component.render(80).join('\n')).split('\n');
    const firstParagraph = lines.findIndex(line => line.includes('First paragraph.'));
    const emojiParagraph = lines.findIndex(line => line.includes('👩‍💻'));
    expect(emojiParagraph - firstParagraph).toBe(2);
    const visible = lines.join('\n');
    const graphemes = visible.match(/👩‍💻/gu) ?? [];
    if (mode === 'standard') expect(graphemes).toHaveLength(40);
    else expect(graphemes.length).toBeGreaterThan(0);
    expect(visible.replaceAll('👩‍💻', '')).not.toMatch(/[👩💻‍�]/u);
  });

  it.each([40, 80, 120, 180])('keeps every word of mixed emoji and text lines in quiet mode at width %i', width => {
    const message =
      'This message has two paragraphs and an emoji sequence 👩‍💻👩‍💻👩‍💻 to check wrapping. Please reply with the exact phrase: RECEIVED FULL MESSAGE, and confirm.';
    const component = new ToolExecutionComponentEnhanced(
      'agent_signal_send',
      { ...args, message },
      { quietDisplayMode: 'quiet', quietPreviewLineLimit: 8, collapsedByDefault: true },
      ui,
    );

    const rendered = stripAnsi(component.render(width).join('\n'));
    const previewText = rendered
      .split('\n')
      .filter(line => line.startsWith('  │ '))
      .map(line => line.slice(4).trimEnd())
      .join(' ');

    expect(previewText).not.toContain('…');
    expect(previewText.replace(/\s+/g, '')).toBe(message.replace(/\s+/g, ''));
  });

  it('shows the opening lines of the message up to the quiet preview line limit', () => {
    const component = new ToolExecutionComponentEnhanced(
      'agent_signal_send',
      args,
      { quietDisplayMode: 'quiet', quietPreviewLineLimit: 2, collapsedByDefault: true },
      ui,
    );
    component.updateResult({
      content: [{ type: 'text', text: 'Delivered high signal to "Peer Reviewer" in run run-1' }],
      isError: false,
    });

    const visible = stripAnsi(component.render(80).join('\n'));
    expect(visible).toContain('send');
    expect(visible).toContain(args.targetId);
    expect(visible).toContain('high');
    expect(visible).toContain('reply expected');
    expect(visible).toContain('Please review the auth refactor.');
    expect(visible).toContain('Focus on session renewal.');
    expect(visible).not.toContain('Report any blocking issues.');
    expect(visible).not.toContain('Delivered high signal to "Peer Reviewer" in run run-1');
  });
});

describe('ToolExecutionComponentEnhanced quiet display', () => {
  it('shows the latest lines from partial generic tool progress in quiet mode', () => {
    const component = new ToolExecutionComponentEnhanced(
      'mastra_expert',
      { question: 'How does tool streaming work?' },
      { quietDisplayMode: 'quiet', quietPreviewLineLimit: 2, collapsedByDefault: true },
      ui,
    );

    component.updateResult(
      {
        content: [
          {
            type: 'text',
            text: [
              'Task: How does tool streaming work?',
              '───',
              '✓ view {"path":"knowledge/features/tools/README.md"}',
              '⋯ search_content {"pattern":"createTool"}',
            ].join('\n'),
          },
        ],
        isError: false,
      },
      true,
    );

    const visible = stripAnsi(component.render(120).join('\n'));
    expect(visible).toContain('✓ view {"path":"knowledge/features/tools/README.md"}');
    expect(visible).toContain('⋯ search_content {"pattern":"createTool"}');
    expect(visible).not.toContain('Task: How does tool streaming work?');
  });

  it('keeps completed generic tool previews compact in quiet mode', () => {
    const component = new ToolExecutionComponentEnhanced(
      'mastra_expert',
      { question: 'How does tool streaming work?' },
      { quietDisplayMode: 'quiet', quietPreviewLineLimit: 2, collapsedByDefault: true },
      ui,
    );

    component.updateResult({
      content: [{ type: 'text', text: ['first', 'second', 'third'].join('\n') }],
      isError: false,
    });

    const visible = stripAnsi(component.render(120).join('\n'));
    expect(visible).toContain('first');
    expect(visible).toContain('second');
    expect(visible).not.toContain('third');
  });

  it('renders quiet view tools with a path range summary and content preview', () => {
    const component = new ToolExecutionComponentEnhanced(
      'view',
      { path: 'src/example.ts', offset: 10, limit: 5, showLineNumbers: true },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.updateResult({
      content: [{ type: 'text', text: '    10→const first = 1;\n    11→const second = 2;' }],
      isError: false,
    });

    const output = component.render(100).join('\n');
    const visible = stripAnsi(output);
    expect(output).toContain('view');
    expect(visible).toContain('src/example.ts:10-14');
    expect(output).not.toContain('path=');
    expect(output).not.toContain('✓');
    expect(output).not.toContain('╭──');
    expect(visible).toContain('│ const first = 1;');
    expect(visible).toContain('│ const second = 2;');
    expect(visible).toContain('╰──');
    expect(output.split('\n')).toHaveLength(4);
  });

  it('highlights quiet view previews before truncating displayed lines', () => {
    const component = new ToolExecutionComponentEnhanced(
      'view',
      { path: 'src/example.ts', offset: 1, limit: 1, showLineNumbers: true },
      { quietDisplayMode: 'quiet', quietPreviewLineLimit: 8, collapsedByDefault: true },
      ui,
    );
    const longLine = `     1→const value = '${'x'.repeat(400)}';`;

    component.updateResult({
      content: [{ type: 'text', text: longLine }],
      isError: false,
    });

    const output = component.render(120).join('\n');
    expect(stripAnsi(output)).not.toContain('\u001b');
    expect(stripAnsi(output)).toContain('│ const value =');
  });

  it('shows the latest complete lines for large quiet write previews', () => {
    const hugeContent = Array.from(
      { length: 120 },
      (_, index) => `const row${index} = { id: ${index}, label: 'WRITE_STREAM_${String(index).padStart(5, '0')}' };`,
    ).join('\n');
    const component = new ToolExecutionComponentEnhanced(
      'write_file',
      { path: 'src/large.ts', content: hugeContent },
      { quietDisplayMode: 'quiet', quietPreviewLineLimit: 4, collapsedByDefault: true },
      ui,
    );

    const output = component.render(120).join('\n');
    const visible = stripAnsi(output);
    expect(output).toContain('\u001b[');
    expect(visible).toContain('write');
    expect(visible).toContain('src/large.ts');
    expect(visible).toContain('WRITE_STREAM_00119');
    expect(visible).not.toContain('WRITE_STREAM_00000');
  });

  it('keeps the beginning of a growing single-line write preview visible', () => {
    const component = new ToolExecutionComponentEnhanced(
      'write_file',
      { path: 'src/large.ts', content: `const stableStart = '${'x'.repeat(3_000)}';` },
      { quietDisplayMode: 'quiet', quietPreviewLineLimit: 4, collapsedByDefault: true },
      ui,
    );

    const visible = stripAnsi(component.render(120).join('\n'));
    expect(visible).toContain('const stableStart');
  });

  it('shows old_string while large quiet edit new_string has not streamed yet', () => {
    const oldString = Array.from(
      { length: 80 },
      (_, index) => `const oldRow${index} = { id: ${index}, label: 'OLD_STREAM_${String(index).padStart(5, '0')}' };`,
    ).join('\n');
    const component = new ToolExecutionComponentEnhanced(
      'string_replace_lsp',
      { path: 'src/large.ts', old_string: oldString },
      { quietDisplayMode: 'quiet', quietPreviewLineLimit: 4, collapsedByDefault: true },
      ui,
    );

    const output = component.render(120).join('\n');
    const visible = stripAnsi(output);
    expect(output).toContain('\u001b[');
    expect(visible).toContain('edit');
    expect(visible).toContain('src/large.ts');
    expect(visible).toContain('OLD_STREAM_00079');
    expect(visible).not.toContain('OLD_STREAM_00000');
  });

  it('keeps quiet write preview detail rows stable while streamed content changes', () => {
    const component = new ToolExecutionComponentEnhanced(
      'write_file',
      { path: 'src/example.ts', content: 'first\nsecond\nthird\nfourth' },
      { quietDisplayMode: 'quiet', quietPreviewLineLimit: 4, collapsedByDefault: true },
      ui,
    );

    expect(component.render(100)).toHaveLength(6);

    component.updateArgs({ path: 'src/example.ts', content: 'new first\nnew second\nnew third' });
    let lines = component.render(100).map(stripAnsi);
    expect(lines).toHaveLength(6);
    expect(lines.join('\n')).toContain('new third');
    expect(lines.join('\n')).not.toContain('fourth');

    component.updateArgs({ path: 'src/example.ts', content: 'next first\nnext second\nnext third\nnext fourth' });
    lines = component.render(100).map(stripAnsi);
    expect(lines).toHaveLength(6);
    expect(lines.join('\n')).toContain('next fourth');
  });

  it('keeps quiet edit preview detail rows stable while switching to new_string', () => {
    const component = new ToolExecutionComponentEnhanced(
      'string_replace_lsp',
      { path: 'src/example.ts', old_string: 'old first\nold second\nold third\nold fourth' },
      { quietDisplayMode: 'quiet', quietPreviewLineLimit: 4, collapsedByDefault: true },
      ui,
    );

    expect(component.render(100)).toHaveLength(6);

    component.updateArgs({
      path: 'src/example.ts',
      old_string: 'old first\nold second\nold third\nold fourth',
      new_string: 'new first\nnew second',
    });
    let lines = component.render(100).map(stripAnsi);
    expect(lines).toHaveLength(6);
    expect(lines.join('\n')).toContain('new second');
    expect(lines.join('\n')).not.toContain('old fourth');

    component.updateArgs({
      path: 'src/example.ts',
      old_string: 'old first\nold second\nold third\nold fourth',
      new_string: 'next first\nnext second\nnext third\nnext fourth',
    });
    lines = component.render(100).map(stripAnsi);
    expect(lines).toHaveLength(6);
    expect(lines.join('\n')).toContain('next fourth');
  });

  it('keeps quiet generic preview detail rows stable through completion', () => {
    const component = new ToolExecutionComponentEnhanced(
      'mastra_expert',
      { question: 'Explain previews' },
      { quietDisplayMode: 'quiet', quietPreviewLineLimit: 4, collapsedByDefault: true },
      ui,
    );

    component.updateResult({ content: [{ type: 'text', text: 'first\nsecond\nthird\nfourth' }], isError: false }, true);
    expect(component.render(100)).toHaveLength(6);

    component.updateResult({ content: [{ type: 'text', text: 'complete result' }], isError: false });
    const lines = component.render(100).map(stripAnsi);
    expect(lines).toHaveLength(6);
    expect(lines.join('\n')).toContain('complete result');
    expect(lines.join('\n')).not.toContain('fourth');
  });

  it('does not reserve quiet preview rows before content and resets the floor at zero', () => {
    const component = new ToolExecutionComponentEnhanced(
      'write_file',
      { path: 'src/example.ts', content: '' },
      { quietDisplayMode: 'quiet', quietPreviewLineLimit: 4, collapsedByDefault: true },
      ui,
    );

    expect(component.render(100)).toHaveLength(1);
    expect(component.hasQuietStreamingPreview()).toBe(false);

    component.updateArgs({ path: 'src/example.ts', content: 'first\nsecond\nthird\nfourth' });
    expect(component.render(100)).toHaveLength(6);

    component.setQuietPreviewLineLimit(0);
    component.updateArgs({ path: 'src/example.ts', content: '' });
    expect(component.render(100)).toHaveLength(1);
    expect(component.hasQuietStreamingPreview()).toBe(false);

    component.setQuietPreviewLineLimit(4);
    expect(component.render(100)).toHaveLength(1);
    expect(component.hasQuietStreamingPreview()).toBe(false);
  });

  it('clamps the quiet preview floor when the configured limit is lowered', () => {
    const component = new ToolExecutionComponentEnhanced(
      'write_file',
      { path: 'src/example.ts', content: 'first\nsecond\nthird\nfourth' },
      { quietDisplayMode: 'quiet', quietPreviewLineLimit: 4, collapsedByDefault: true },
      ui,
    );

    expect(component.render(100)).toHaveLength(6);
    component.setQuietPreviewLineLimit(2);
    component.updateArgs({ path: 'src/example.ts', content: 'short' });
    expect(component.render(100)).toHaveLength(4);

    component.setQuietPreviewLineLimit(4);
    expect(component.render(100)).toHaveLength(4);

    component.updateArgs({ path: 'src/example.ts', content: 'next first\nnext second\nnext third\nnext fourth' });
    expect(component.render(100)).toHaveLength(6);
  });

  it('preserves continuation geometry when an established quiet preview becomes empty', () => {
    const component = new ToolExecutionComponentEnhanced(
      'mastra_expert',
      { question: 'Explain previews' },
      { quietDisplayMode: 'quiet', quietPreviewLineLimit: 4, collapsedByDefault: true },
      ui,
    );
    component.setCompactToolHasFollowingContinuation(true);
    component.updateResult({ content: [{ type: 'text', text: 'first\nsecond\nthird\nfourth' }], isError: false }, true);

    let lines = component.render(100).map(stripAnsi);
    expect(lines).toHaveLength(6);
    expect(lines.slice(1, 5).every(line => line.includes('│'))).toBe(true);
    expect(lines[5]).toContain('│');
    expect(lines.join('\n')).not.toContain('╰──');

    component.updateResult({ content: [{ type: 'text', text: '' }], isError: false }, true);
    expect(component.hasQuietStreamingPreview()).toBe(true);
    lines = component.render(100).map(stripAnsi);
    expect(lines).toHaveLength(6);
    expect(lines.slice(1, 5).every(line => line.trim() === '│')).toBe(true);
    expect(lines[5]!.trim()).toBe('│');
    expect(lines.join('\n')).not.toContain('╰──');
  });

  it('shows exactly the immediate dirname and filename once continuation paths are available', () => {
    const component = new ToolExecutionComponentEnhanced(
      'view',
      { path: '/tmp/quiet-prefix-demo/project/src/tui/rendering/beta-widget.ts', offset: 1, limit: 3 },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.setCompactToolContinuation(true, '/tmp/quiet-prefix-demo/project/src/tui/components/alpha-widget.ts:1-3');

    const output = stripAnsi(component.render(120).join('\n'));
    expect(output).toContain('/rendering/beta-widget.ts:1-3');
    expect(output).not.toContain('/tui/rendering/beta-widget.ts:1-3');
  });

  it('does not show raw streamed continuation paths before previous context is available', () => {
    const component = new ToolExecutionComponentEnhanced(
      'view',
      { path: 'mastracode/src/' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.setCompactToolContinuation(true);

    const output = stripAnsi(component.render(100).join('\n'));
    expect(output).not.toContain('mastracode');
    expect(output).not.toContain('src');
  });

  it('holds partial continuation path segments until a slash streams in', () => {
    const component = new ToolExecutionComponentEnhanced(
      'view',
      { path: 'mastracode/s' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.setCompactToolContinuation(true, 'mastracode/src/tui/components/tool-execution-enhanced.ts:1-2');

    const output = stripAnsi(component.render(100).join('\n'));
    expect(output).toContain('────────────');
    expect(output).not.toContain('mastracode/s');
  });

  it('holds continuation path segments when previous segment is still incomplete', () => {
    const component = new ToolExecutionComponentEnhanced(
      'view',
      { path: 'mastracode/src' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.setCompactToolContinuation(true, 'mastracode/s');

    const output = stripAnsi(component.render(100).join('\n'));
    expect(output).toContain('────────────');
    expect(output).not.toContain('src');
  });

  it('streams divergent path segments immediately', () => {
    const component = new ToolExecutionComponentEnhanced(
      'view',
      { path: 'mastracode/src' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.setCompactToolContinuation(true, 'mastracode/lib/tool-execution-enhanced.ts:1-2');

    const output = stripAnsi(component.render(100).join('\n'));
    expect(output).toContain('/src');
    expect(output).not.toContain('mastracode/src');
  });

  it('streams from the divergent path segment after matching prefixes', () => {
    const component = new ToolExecutionComponentEnhanced(
      'view',
      { path: 'mastracode/src/tui/comments' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.setCompactToolContinuation(true, 'mastracode/src/tui/components/tool-execution-enhanced.ts:1-2');

    const output = stripAnsi(component.render(100).join('\n'));
    expect(output).toContain('/comments');
    expect(output).not.toContain('mastracode/src/tui/com');
  });

  it('preserves the filename when continuation paths are identical', () => {
    const component = new ToolExecutionComponentEnhanced(
      'view',
      { path: 'mastracode/src/tui/components/tool-execution-enhanced.ts' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.setCompactToolContinuation(true, 'mastracode/src/tui/components/tool-execution-enhanced.ts');

    const output = stripAnsi(component.render(120).join('\n'));
    expect(output).toContain('/tool-execution-enhanced.ts');
    expect(output).not.toContain('mastracode/src/tui/components/tool-execution-enhanced.ts');
  });

  it('renders matching completed continuation segments as connector chunks', () => {
    const component = new ToolExecutionComponentEnhanced(
      'view',
      { path: 'mastracode/lib/' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.setCompactToolContinuation(true, 'mastracode/lib/tool-execution-enhanced.ts:1-2');

    const output = stripAnsi(component.render(100).join('\n'));
    expect(output).toContain('────────────────');
    expect(output).not.toContain('mastracode/lib');
    expect(output).not.toContain('/lib/');
  });

  it('only hides complete shared path segments in continuations', () => {
    const component = new ToolExecutionComponentEnhanced(
      'view',
      { path: '/tmp/commands/settings.ts', offset: 1, limit: 2 },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.setCompactToolContinuation(true, '/tmp/components/task-progress.ts:1-2');

    const output = stripAnsi(component.render(100).join('\n'));
    expect(output).toContain('/commands/settings.ts:1-2');
    expect(output).not.toContain('───mands/settings.ts');
  });

  it('does not render a quiet view preview line that duplicates the summary', () => {
    const component = new ToolExecutionComponentEnhanced(
      'view',
      { path: 'src/example.ts', offset: 10, limit: 5, showLineNumbers: true },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    const lines = component.render(100);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('view');
    expect(stripAnsi(lines[0]!)).toContain('src/example.ts:10-14');
    expect(lines[0]).not.toContain('⟶');
  });

  it('renders quiet list tools with result preview lines', () => {
    const component = new ToolExecutionComponentEnhanced(
      'find_files',
      { path: 'src', pattern: '**/*.ts' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.updateResult({
      content: [{ type: 'text', text: '.\nsrc/a.ts\nsrc/b.ts\nsrc/c.ts\nsrc/d.ts\nsrc/e.ts' }],
      isError: false,
    });

    const rendered = component.render(100).join('\n');
    const output = stripAnsi(rendered);
    expect(output).toContain('▐list▌src (5 results)');
    expect(output).not.toContain('│ .');
    expect(rendered).toContain(theme.fg('toolOutput', 'src/a.ts'));
    expect(rendered).toContain(theme.fg('toolOutput', 'src/b.ts'));
    expect(output).not.toContain('src/c.ts');
    expect(output).toContain('╰──');
  });

  it('renders quiet web search with query summary and compact result preview', () => {
    const component = new ToolExecutionComponentEnhanced(
      'web_search',
      { query: 'muted cli-highlight theme' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.updateResult({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            sources: [
              { title: 'cli-highlight README', url: 'https://github.com/felixfbecker/cli-highlight' },
              { title: 'highlight.js Themes', url: 'https://highlightjs.org' },
            ],
          }),
        },
      ],
      isError: false,
    });

    const output = stripAnsi(component.render(100).join('\n'));
    expect(output).toContain('▐web▌"muted cli-highlight theme"');
    expect(output).toContain('│ cli-highlight README');
    expect(output).toContain('│ https://github.com/felixfbecker/cli-highlight');
    expect(output).not.toContain('highlight.js Themes');
    expect(output).not.toContain('sources');
  });

  it('renders normal Anthropic web search results without encrypted content', () => {
    const component = new ToolExecutionComponentEnhanced('web_search_20250305', { query: 'mastra docs' }, {}, ui);

    component.updateResult({
      content: [
        {
          type: 'text',
          text: JSON.stringify([
            {
              title: 'Mastra Docs',
              url: 'https://mastra.ai/docs',
              pageAge: '1 week ago',
              encryptedContent: 'do-not-render-this-blob',
            },
            {
              title: 'Mastra Reference',
              url: 'https://mastra.ai/reference',
              encryptedContent: 'another-hidden-blob',
            },
          ]),
        },
      ],
      isError: false,
    });

    const output = stripAnsi(component.render(120).join('\n'));
    expect(output).toContain('Mastra Docs (1 week ago)');
    expect(output).toContain('https://mastra.ai/docs');
    expect(output).toContain('Mastra Reference');
    expect(output).toContain('╰── web_search "mastra docs" ✓');
    expect(output).not.toContain('encryptedContent');
    expect(output).not.toContain('do-not-render-this-blob');
  });

  it('renders normal OpenAI web search sources and falls back to the result action query', () => {
    const component = new ToolExecutionComponentEnhanced('web_search', {}, {}, ui);

    component.updateResult({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            action: { query: 'latest mastra release' },
            sources: [
              { title: 'Release notes', url: 'https://mastra.ai/changelog' },
              { url: 'https://github.com/mastra-ai/mastra/releases' },
            ],
          }),
        },
      ],
      isError: false,
    });

    const output = stripAnsi(component.render(120).join('\n'));
    expect(output).toContain('Release notes');
    expect(output).toContain('https://mastra.ai/changelog');
    expect(output).toContain('https://github.com/mastra-ai/mastra/releases');
    expect(output).toContain('╰── web_search "latest mastra release" ✓');
    expect(output).not.toContain('sources');
    expect(output).not.toContain('action');
  });

  it('passes Tavily markdown through normal web search rendering without JSON double-formatting', () => {
    const component = new ToolExecutionComponentEnhanced('web_search', { query: 'agent frameworks' }, {}, ui);

    component.updateResult({
      content: [
        {
          type: 'text',
          text: 'Answer: Mastra is an agent framework.\n\n## Mastra\nhttps://mastra.ai\nBuild agents and workflows.',
        },
      ],
      isError: false,
    });

    const output = stripAnsi(component.render(120).join('\n'));
    expect(output).toContain('Answer: Mastra is an agent framework.');
    expect(output).toContain('## Mastra');
    expect(output).toContain('https://mastra.ai');
    expect(output).toContain('╰── web_search "agent frameworks" ✓');
    expect(output).not.toContain('"Answer:');
  });

  it('colors quiet compact tool labels by status', () => {
    const active = new ToolExecutionComponentEnhanced(
      'view',
      { path: 'src/example.ts' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    expect(stripAnsi(active.render(100).join('\n'))).toContain('▐view▌src/example.ts');

    const complete = new ToolExecutionComponentEnhanced(
      'view',
      { path: 'src/example.ts' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    complete.updateResult({ content: [{ type: 'text', text: 'done' }], isError: false });
    expect(stripAnsi(complete.render(100).join('\n'))).toContain('▐view▌src/example.ts');
  });

  it('shows background provenance through running, completed, and failed states', () => {
    const component = new ToolExecutionComponentEnhanced(
      'view',
      { path: 'package.json' },
      { quietDisplayMode: 'normal', collapsedByDefault: false },
      ui,
    );
    const placeholder = 'Background task started. Task ID: task-1. The tool "view" is running in the background.';

    component.updateResult({ content: [{ type: 'text', text: placeholder }], isError: false });
    expect(stripAnsi(component.render(100).join('\n'))).not.toContain('background · task-1');
    component.setBackgroundTaskId('task-1');
    component.updateResult({ content: [{ type: 'text', text: placeholder }], isError: false }, true);

    let output = stripAnsi(component.render(100).join('\n'));
    expect(output).toContain('view');
    expect(output).toContain('package.json');
    expect(output).toContain('◌ background · task-1');

    component.updateResult({ content: [{ type: 'text', text: 'completed result' }], isError: false });
    output = stripAnsi(component.render(100).join('\n'));
    expect(output).toContain('✓ background · task-1');
    expect(output).toContain('completed result');

    component.updateResult({ content: [{ type: 'text', text: 'failed result' }], isError: true });
    output = stripAnsi(component.render(100).join('\n'));
    expect(output).toContain('✗ background · task-1');
    expect(output).toContain('failed result');

    const cancelled = new ToolExecutionComponentEnhanced(
      'find_files',
      { path: '.' },
      { quietDisplayMode: 'normal', collapsedByDefault: false },
      ui,
    );
    cancelled.setBackgroundTaskId('task-2');
    cancelled.updateResult(
      { content: [{ type: 'text', text: 'Background execution cancelled.' }], isError: true },
      true,
    );
    cancelled.cancelBackground();
    output = stripAnsi(cancelled.render(100).join('\n'));
    expect(output).toContain('■ background · task-2');
    expect(output).not.toContain('◌ background');
  });

  it('uses the active mode color for quiet compact tool badges', () => {
    const modeColor = '#3366cc';
    const component = new ToolExecutionComponentEnhanced(
      'view',
      { path: 'src/example.ts' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true, compactToolModeColor: modeColor },
      ui,
    );

    component.updateResult({
      content: [{ type: 'text', text: '     1→const value = true;' }],
      isError: false,
    });

    const output = component.render(100).join('\n');
    expect(output).toContain(chalk.hex(modeColor)('▐'));
    expect(output).toContain(chalk.bgHex(modeColor).hex('#000000').bold('view'));
    expect(output).toContain(chalk.bgHex('#141414').hex(modeColor)('src/example.ts'));
    expect(output).toContain(chalk.hex(ensureTerminalGlyphContrast(tintHex(modeColor, 0.35)))('│'));
  });

  it('renders quiet non-shell tool validation errors with actionable details', () => {
    const component = new ToolExecutionComponentEnhanced(
      'ask_user',
      {},
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.updateResult({
      content: [{ type: 'text', text: 'Validation error: missing required parameter "question"' }],
      isError: true,
    });

    const output = stripAnsi(component.render(100).join('\n'));
    expect(output).toContain('ask_user');
    expect(output).toContain('✗');
    expect(output).toContain('Validation error: missing required parameter "question"');
    expect(output).not.toContain('╭──');
  });

  it('renders quiet non-shell tool errors through detailed renderers', () => {
    const component = new ToolExecutionComponentEnhanced(
      'string_replace_lsp',
      { path: 'src/example.ts', old_string: 'missing', new_string: 'replacement' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.updateResult({ content: [{ type: 'text', text: 'The specified text was not found.' }], isError: false });

    const output = stripAnsi(component.render(100).join('\n'));
    expect(output).toContain('edit');
    expect(output).toContain('src/example.ts');
    expect(output).toContain('✗');
    expect(output).toContain('The specified text was not found.');
    expect(output).not.toContain('╭──');
  });

  it('renders quiet edit tools with line ranges from the tool result', () => {
    const component = new ToolExecutionComponentEnhanced(
      'string_replace_lsp',
      { path: 'src/example.ts', old_string: 'old', new_string: 'new' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.updateResult({
      content: [{ type: 'text', text: 'Replaced 1 occurrence in src/example.ts (lines 42-44)' }],
      isError: false,
    });

    const output = component.render(100).join('\n');
    const visible = stripAnsi(output);
    expect(output).toContain('edit');
    expect(visible).toContain('src/example.ts:42-44');
    expect(visible).toContain('new');
    expect(visible).not.toContain('old →');
    expect(output).not.toContain('old_string=');
    expect(output.split('\n')).toHaveLength(3);
  });

  it('updates the quiet edit preview line from partial args', () => {
    const component = new ToolExecutionComponentEnhanced(
      'string_replace_lsp',
      { path: 'src/example.ts', old_string: 'old value' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    let lines = component.render(100);
    expect(lines).toHaveLength(3);
    expect(stripAnsi(lines[1]!)).toContain('old value');
    expect(stripAnsi(lines[2]!)).toContain('╰──');

    component.updateArgs({ path: 'src/example.ts', old_string: 'old value', new_string: 'new value\nmore' });
    lines = component.render(100);
    expect(lines).toHaveLength(4);
    expect(stripAnsi(lines[1]!)).toContain('new value');
    expect(stripAnsi(lines[2]!)).toContain('more');
    expect(stripAnsi(lines[3]!)).toContain('╰──');
    expect(stripAnsi(lines.join('\n'))).not.toContain('old value');
    expect(stripAnsi(lines.join('\n'))).not.toContain('(2 lines)');
  });

  it('renders quiet write tools with path and content preview lines', () => {
    const component = new ToolExecutionComponentEnhanced(
      'write_file',
      { path: '/tmp/example.ts', content: "import { x } from 'y';\nconsole.log(x);" },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.updateResult({ content: [{ type: 'text', text: 'done' }], isError: false });

    const output = component.render(140).join('\n');
    const visible = stripAnsi(output);
    expect(visible).toContain('write');
    expect(visible).toContain('/tmp/example.ts');
    expect(visible).toContain("import { x } from 'y';");
    expect(visible).toContain('console.log(x);');
    expect(visible).toContain('│');
    expect(visible).not.toContain('(2 lines)');
    expect(visible).not.toContain('content=');
    expect(output.split('\n')).toHaveLength(4);
  });

  it('renders a quiet write preview line with content preview', () => {
    const component = new ToolExecutionComponentEnhanced(
      'write_file',
      { path: '/tmp/example.ts', content: 'first line\nsecond line' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    const lines = component.render(100);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('write');
    expect(lines[1]).toContain('│');
    expect(lines[1]).not.toContain('/tmp/example.ts');
    expect(lines[1]).toContain('first line');
    expect(lines[2]).toContain('second line');
    expect(stripAnsi(lines[3]!)).toContain('╰──');
    expect(lines.join('\n')).not.toContain('(2 lines)');
  });

  it('preserves left indentation in quiet code previews', () => {
    const component = new ToolExecutionComponentEnhanced(
      'write_file',
      { path: '/tmp/example.ts', content: 'if (ok) {\n  return value;\n}' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    const lines = component.render(100).map(stripAnsi);
    expect(lines[1]).toContain('│   return value;');
  });

  it('hides quiet detail previews when the preview line limit is zero', () => {
    const component = new ToolExecutionComponentEnhanced(
      'write_file',
      { path: '/tmp/example.ts', content: 'first line\nsecond line' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 0 },
      ui,
    );

    const lines = component.render(100).map(stripAnsi);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('▐write▌/tmp/example.ts');
    expect(lines.join('\n')).not.toContain('first line');
    expect(component.hasQuietStreamingPreview()).toBe(false);
  });

  it('uses the configured quiet detail preview line limit', () => {
    const component = new ToolExecutionComponentEnhanced(
      'write_file',
      {
        path: '/tmp/example.ts',
        content: 'const first = 1;\nconst second = 2;\nconst third = 3;\nconst fourth = 4;',
      },
      { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 3 },
      ui,
    );

    const lines = component.render(100).map(stripAnsi);
    expect(lines).toHaveLength(5);
    expect(lines.join('\n')).not.toContain('const first = 1;');
    expect(lines.join('\n')).toContain('const second = 2;');
    expect(lines.join('\n')).toContain('const third = 3;');
    expect(lines.join('\n')).toContain('const fourth = 4;');
    expect(lines[4]).toContain('╰──');
  });

  it('rolls long quiet write previews through two detail lines by default', () => {
    const component = new ToolExecutionComponentEnhanced(
      'write_file',
      {
        path: '/tmp/example.ts',
        content:
          'const first = 1;\nconst second = 2;\nconst third = 3;\nconst fourth = 4;\nconst fifth = 5;\nconst sixth = 6;\nconst seventh = 7;\nconst eighth = 8;\nconst ninth = 9;',
      },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    const lines = component.render(74);
    expect(lines).toHaveLength(4);
    expect(stripAnsi(lines[3]!)).toContain('╰──');
    const visible = stripAnsi(lines.join('\n'));
    expect(visible).not.toContain('const first = 1');
    expect(visible).toContain('const eighth = 8;');
    expect(visible).toContain('const ninth = 9;');
  });

  it('shows previews on grouped quiet write continuations', () => {
    const first = new ToolExecutionComponentEnhanced(
      'write_file',
      { path: '/tmp/a.ts', content: 'const first = 1;' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    const second = new ToolExecutionComponentEnhanced(
      'write_file',
      { path: '/tmp/b.ts', content: 'const second = 2;\nconst third = 3;' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    second.setCompactToolContinuation(true, '/tmp/a.ts');
    const lines = second.render(100);
    expect(lines).toHaveLength(4);
    expect(stripAnsi(lines[0]!)).toContain('●─');
    expect(stripAnsi(lines[1]!)).toContain('const second = 2;');
    expect(stripAnsi(lines[2]!)).toContain('const third = 3;');
    expect(stripAnsi(lines[3]!)).toContain('╰──');
    expect(stripAnsi(first.render(100).join('\n'))).toContain('const first = 1;');
  });

  it('uses a closed continuation header when preview lines are disabled', () => {
    const component = new ToolExecutionComponentEnhanced(
      'write_file',
      { path: '/tmp/a.ts', content: 'const first = 1;' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 0 },
      ui,
    );

    component.setCompactToolContinuation(true, '/tmp/previous.ts');
    const lines = component.render(100).map(stripAnsi);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('╰─');
    expect(lines[0]).not.toContain('●─');
  });

  it('does not use orange dot continuation markers when preview lines are disabled', () => {
    const component = new ToolExecutionComponentEnhanced(
      'write_file',
      { path: '/tmp/a.ts', content: 'const first = 1;' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 0 },
      ui,
    );

    component.setCompactToolContinuation(true, '/tmp/previous.ts');
    component.setCompactToolHasFollowingContinuation(true);
    const lines = component.render(100).map(stripAnsi);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('├─');
    expect(lines[0]).not.toContain('●─');
  });

  it('uses an open continuation header when the continuation has preview lines', () => {
    const component = new ToolExecutionComponentEnhanced(
      'write_file',
      { path: '/tmp/a.ts', content: 'const first = 1;\nconst second = 2;' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.setCompactToolHasFollowingContinuation(true);
    component.updateResult({ content: [{ type: 'text', text: 'done' }], isError: false });
    const lines = component.render(100).map(stripAnsi);
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain('│ const first = 1;');
    expect(lines[2]).toContain('│ const second = 2;');
    expect(lines[3]).toContain('│');
    expect(lines.join('\n')).not.toContain('╰─');
  });

  it('streams quiet grep path on the tool line and pattern on the detail line', () => {
    const component = new ToolExecutionComponentEnhanced(
      'search_content',
      { pattern: 'foo' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    let lines = component.render(100);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('grep');
    expect(lines[0]).not.toContain('foo');
    expect(lines[1]).toContain('│');
    expect(lines[1]).toContain(theme.fg('toolOutput', 'foo'));
    expect(stripAnsi(lines[2]!)).toContain('╰──');

    component.updateArgs({ pattern: 'foo', path: 'src/**/*.ts' });
    lines = component.render(100);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('src/**/*.ts');
    expect(lines[0]).not.toContain('foo');
    expect(lines[1]).toContain('│');
    expect(lines[1]).toContain(theme.fg('toolOutput', 'foo'));
    expect(lines[1]).not.toContain('src/**/*.ts');
    expect(stripAnsi(lines[2]!)).toContain('╰──');

    component.updateResult({
      content: [{ type: 'text', text: '2 matches across 1 file\nsrc/a.ts:1:foo\nsrc/b.ts:2:foo' }],
      isError: false,
    });
    lines = component.render(100);
    expect(stripAnsi(lines[1]!)).toContain('foo (2 results)');
  });

  it('renders quiet skill tools with the skill name only', () => {
    const component = new ToolExecutionComponentEnhanced(
      'skill',
      { name: 'testing-mastracode-tui' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.updateResult({ content: [{ type: 'text', text: 'done' }], isError: false });

    const output = component.render(100).join('\n');
    expect(output).toContain('skill');
    expect(output).toContain('testing-mastracode-tui');
    expect(output).not.toContain('name=');
    expect(output.split('\n')).toHaveLength(1);
  });

  it('previews the last N output lines above the $ header of the shell box', () => {
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command: 'pnpm test', description: 'Running the tests', cwd: '/tmp/w' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 2 },
      ui,
    );
    component.updateResult(
      {
        content: [{ type: 'text', text: Array.from({ length: 16 }, (_, i) => `line ${i + 1}`).join('\n') }],
        isError: false,
      },
      false,
    );

    const lines = renderInChat([component]);
    expect(lines).toEqual([
      expect.stringMatching(/^╭─+╮$/),
      expect.stringMatching(/^│ line 15 +│$/),
      expect.stringMatching(/^│ line 16 +│$/),
      expect.stringMatching(/^├─+┤$/),
      expect.stringMatching(/^│ \$ \/tmp\/w +│$/),
      expect.stringMatching(/^├─+┤$/),
      expect.stringMatching(/^│ ✓ Running the tests +\d+ms │$/),
      expect.stringMatching(/^╰─+╯$/),
    ]);
  });

  it('streams the latest output of any call in the box into one shared preview', () => {
    const make = (description: string) => {
      const component = new ToolExecutionComponentEnhanced(
        'execute_command',
        { command: 'pnpm test', description, cwd: '/tmp/w' },
        { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 2 },
        ui,
      );
      return component;
    };
    const first = make('Building');
    first.updateResult({ content: [{ type: 'text', text: 'built 1\nbuilt 2\nbuilt 3' }], isError: false }, false);
    const second = make('Testing');

    // Until the running call prints something, the preview keeps the last output
    let lines = renderInChat([first, second]);
    expect(lines.filter(line => line.startsWith('╭'))).toHaveLength(1);
    expect(lines.slice(1, 3)).toEqual([
      expect.stringMatching(/^│ built 2 +│$/),
      expect.stringMatching(/^│ built 3 +│$/),
    ]);

    second.appendStreamingOutput('stream 1\nstream 2\nstream 3');
    lines = renderInChat([first, second]);
    expect(lines.slice(1, 3)).toEqual([
      expect.stringMatching(/^│ stream 2 +│$/),
      expect.stringMatching(/^│ stream 3 +│$/),
    ]);
    expect(lines.join('\n')).not.toContain('built');
    expect(lines).toHaveLength(9);
    first.stopLiveUpdates();
    second.stopLiveUpdates();
  });

  it('never shrinks the preview, so rows below it do not jump', () => {
    const make = (description: string) =>
      new ToolExecutionComponentEnhanced(
        'execute_command',
        { command: 'pnpm test', description, cwd: '/tmp/w' },
        { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 3 },
        ui,
      );
    const first = make('Building');
    first.updateResult({ content: [{ type: 'text', text: 'a\nb\nc' }], isError: false }, false);
    const second = make('Testing');
    second.updateResult({ content: [{ type: 'text', text: 'done' }], isError: false }, false);
    const chat = new Container();
    chat.addChild(first);
    reconcileChatBoundarySpacers(chat);
    const before = chat.render(80).length;

    // The next call prints a single line; the preview keeps its three rows
    chat.addChild(second);
    reconcileChatBoundarySpacers(chat);
    const after = stripAnsi(chat.render(80).join('\n')).split('\n');
    expect(after).toHaveLength(before + 1);
    expect(after.slice(1, 4)).toEqual([
      expect.stringMatching(/^│ done +│/),
      expect.stringMatching(/^│ +│/),
      expect.stringMatching(/^│ +│/),
    ]);
  });

  it('hides quiet shell output entirely when the preview limit is None', () => {
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command: 'seq 1 5' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 0 },
      ui,
    );
    component.updateResult({ content: [{ type: 'text', text: '1\n2\n3\n4\n5' }], isError: false }, false);

    const visible = stripAnsi(component.render(60).join('\n'));
    expect(visible).toMatch(/│ ✓ seq 1 5 +\d+ms │/);
    expect(visible).not.toMatch(/^\s*│ [1-5]/m);
    expect(visible).not.toContain('⋯ (+');
    // top, header, divider, row, bottom
    expect(visible.split('\n')).toHaveLength(5);
  });

  it('expanding a quiet shell tool reveals the full command and output', () => {
    const command = ["python3 - <<'EOF'", "p = 'file.ts'", 's = open(p).read()', 'EOF'].join('\n');
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command },
      { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 1 },
      ui,
    );
    component.updateResult({ content: [{ type: 'text', text: 'out 1\nout 2\nout 3' }], isError: false }, false);

    const collapsed = renderInChat([component]).join('\n');
    expect(collapsed).not.toContain('open(p)');
    expect(collapsed).not.toContain('out 1');
    expect(collapsed).toContain('out 3');

    component.setExpanded(true);
    const expanded = renderInChat([component]).join('\n');
    expect(expanded).toContain('open(p)');
    expect(expanded).toContain('out 1');
    expect(expanded).toContain('out 3');

    component.setExpanded(false);
    expect(renderInChat([component]).join('\n')).not.toContain('out 1');
  });

  it('shows the command description in place of the command in quiet mode', () => {
    const command = ["python3 - <<'EOF'", "p = 'file.ts'", 's = open(p).read()', 'EOF'].join('\n');
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command, description: 'Drilling into the first of 15 failures', cwd: '/tmp/work' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 0 },
      ui,
    );
    component.updateResult({ content: [{ type: 'text', text: 'ok' }], isError: false }, false);

    const quiet = stripAnsi(component.render(80).join('\n'));
    expect(quiet).not.toContain('python3');
    // No preview lines: a lone call is its own group — header, divider, one status row
    expect(quiet).toContain('$ /tmp/work');
    expect(quiet).toMatch(/✓ Drilling into the first of 15 failures +\d+ms/);
    expect(quiet.split('\n')).toHaveLength(5);

    component.setExpanded(true);
    const expanded = stripAnsi(component.render(80).join('\n'));
    expect(expanded).toContain("$ python3 - <<'EOF'");
    expect(expanded).toContain('open(p)');
    expect(expanded).not.toContain('Drilling into');

    component.setExpanded(false);
    component.setQuietModeDisplay('normal');
    const normal = stripAnsi(component.render(80).join('\n'));
    expect(normal).toContain("$ python3 - <<'EOF'");
    expect(normal).not.toContain('Drilling into');
  });

  describe('grouped quiet shell rows (preview lines = None)', () => {
    const make = (args: Record<string, unknown>, result?: { text: string; isError?: boolean }, limit = 0) => {
      const component = new ToolExecutionComponentEnhanced(
        'execute_command',
        args,
        { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: limit },
        ui,
      );
      if (result) {
        component.updateResult({ content: [{ type: 'text', text: result.text }], isError: !!result.isError }, false);
      }
      return component;
    };
    const lines = (component: ToolExecutionComponentEnhanced, width = 80) =>
      stripAnsi(component.render(width).join('\n'))
        .split('\n')
        .map(line => line.trimEnd());

    it('opens, continues, and closes one shared box across consecutive calls', () => {
      const first = make({ command: 'git log', description: 'Listing later commits' }, { text: 'abc' });
      const second = make({ command: 'git show', description: 'Reading the changesets' }, { text: 'def' });
      expect(first.getChatSpacingKind()).toBe('quiet-compact-tool');
      expect(getSpacingBetweenComponents(first, second)).toBe(0);

      first.setCompactToolHasFollowingContinuation(true);
      second.setCompactToolContinuation(true, first.getCompactToolGroupSummary());

      const top = lines(first);
      expect(top[0]).toMatch(/^╭─+╮$/);
      expect(top[1]).toMatch(/^│ \$ \S+ +│$/);
      expect(top[2]).toMatch(/^├─+┤$/);
      expect(top[3]).toMatch(/^│ ✓ Listing later commits +\d+ms │$/);
      expect(top).toHaveLength(4);

      const bottom = lines(second);
      expect(bottom[0]).toMatch(/^│ ✓ Reading the changesets +\d+ms │$/);
      expect(bottom[1]).toMatch(/^╰─+╯$/);
      expect(bottom).toHaveLength(2);
    });

    it('shows the project root in full, paths inside it as ./, and starts a new box per directory', () => {
      const home = homedir();
      const root = make({ command: 'ls', description: 'Listing files' }, { text: '' });
      const root2 = make({ command: 'pwd', description: 'Printing the directory' }, { text: '' });
      const sub = make({ command: 'ls', description: 'Listing sources', cwd: 'src' }, { text: '' });
      const cd = make({ command: 'cd /opt/elsewhere && ls', description: 'Listing elsewhere' }, { text: '' });
      const tilde = make({ command: 'ls', description: 'Listing code', cwd: `${home}/code/project` }, { text: '' });
      const project = process.cwd().startsWith(home) ? `~${process.cwd().slice(home.length)}` : process.cwd();
      expect(root.getCompactToolGroupKey()).toBe(`$ ${project}`);
      expect(sub.getCompactToolGroupKey()).toBe('$ ./src');
      expect(cd.getCompactToolGroupKey()).toBe('$ /opt/elsewhere');
      expect(tilde.getCompactToolGroupKey()).toBe('$ ~/code/project');
      expect(lines(sub, 400)[1]).toContain('│ $ ./src ');

      expect(getSpacingBetweenComponents(root, root2)).toBe(0);
      // A new directory closes one box and opens the next, with no blank line between their borders
      expect(getSpacingBetweenComponents(root, sub)).toBe(0);
      const boxed = make({ command: 'git status', description: 'Checking status' }, { text: 'clean' });
      boxed.setExpanded(true);
      expect(boxed.getChatSpacingKind()).toBe('quiet-shell-tool');
      expect(getSpacingBetweenComponents(sub, boxed)).toBe(0);
      const view = new ToolExecutionComponentEnhanced(
        'view',
        { path: 'a.ts' },
        { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 0 },
        ui,
      );
      expect(getSpacingBetweenComponents(root, view)).toBe(1);
    });

    it('resolves directories against the project root commands run in, not where the TUI was launched', () => {
      // Launched from a subdirectory: commands still run from the git root.
      const inRepo = (args: Record<string, unknown>) =>
        new ToolExecutionComponentEnhanced(
          'execute_command',
          args,
          { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 0, projectRoot: '/work/repo' },
          ui,
        );
      expect(inRepo({ command: 'ls', description: 'Listing' }).getCompactToolGroupKey()).toBe('$ /work/repo');
      expect(inRepo({ command: 'cd packages/core && ls', description: 'Listing' }).getCompactToolGroupKey()).toBe(
        '$ ./packages/core',
      );
      expect(inRepo({ command: 'ls', description: 'Listing', cwd: 'docs' }).getCompactToolGroupKey()).toBe('$ ./docs');
    });

    it('never wraps a row onto a second terminal line, at any width', () => {
      const long = 'x'.repeat(300);
      const cases = [
        () => make({ command: 'ls', description: `Describing ${long}` }, { text: '' }),
        () => make({ command: `cat\t${long}\nsecond line`, cwd: `/tmp/${long}` }, { text: '' }),
        () => make({ command: 'sleep 100', description: `Waiting ${long}` }),
        () =>
          make(
            { command: 'gh pr checks', description: 'Checking CI' },
            {
              text: `Validate changeset packages\tfail\t10m4s\thttps://github.com/${long}\n\nExit code: 1`,
              isError: true,
            },
          ),
      ];
      for (const create of cases) {
        const component = create();
        const expectedRows = lines(component, 200).length;
        for (let width = 12; width <= 200; width += 7) {
          const rendered = component.render(width);
          expect(rendered.length, `rows at width ${width}`).toBe(expectedRows);
          for (const line of rendered) expect(visibleWidth(line), `width ${width}`).toBeLessThanOrEqual(width);
        }
        component.stopLiveUpdates();
      }
    });

    it('shows run time recovered from history, and no fake time when it is unknown', () => {
      const recorded = make({ command: 'sleep 3', description: 'Sleeping' }, { text: '' });
      recorded.setRecordedTiming(1_000, 4_078);
      expect(lines(recorded).find(line => line.includes('Sleeping'))).toMatch(/Sleeping +3\.1s │$/);

      const unknown = make({ command: 'sleep 3', description: 'Sleeping' }, { text: '' });
      unknown.setRecordedTiming(undefined, undefined);
      expect(lines(unknown).find(line => line.includes('Sleeping'))).toMatch(/Sleeping +│$/);
    });

    it('marks a call failed from its sandbox exit record when the result text does not say', () => {
      // When the sandbox itself throws, the result is plain output ending in `Error: …`, no exit code.
      const cases = [
        'Error: Sandbox failed to start',
        'stdout:\nfile.ts\n\nstderr:\nwarning\n\nError: connection reset',
      ];
      for (const text of cases) {
        const withoutRecord = make({ command: 'ls', description: 'Listing files' }, { text });
        expect(lines(withoutRecord).find(line => line.includes('Listing files'))).toMatch(/^│ ✓ /);

        const component = make({ command: 'ls', description: 'Listing files' }, { text });
        component.setCommandExit({ exitCode: -1, success: false });
        const rendered = lines(component);
        expect(rendered.find(line => line.includes('Listing files'))).toMatch(/^│ ✗ /);
        expect(rendered).toContainEqual(expect.stringMatching(/└▸ Error: (Sandbox failed to start|connection reset)/));
      }

      const exited = make({ command: 'false', description: 'Failing quietly' }, { text: '(no output)' });
      exited.setCommandExit({ exitCode: 3, success: false });
      expect(lines(exited)).toContainEqual(expect.stringMatching(/└▸ exit code 3/));
    });

    it('marks failures with a red error line and background calls as started', () => {
      const failed = make(
        { command: 'git log v1..HEAD', description: 'Searching for stdin changes' },
        { text: "fatal: ambiguous argument 'v1..HEAD': unknown revision\nExit code: 128", isError: true },
      );
      failed.setCompactToolContinuation(true);
      failed.setCompactToolHasFollowingContinuation(true);
      expect(lines(failed)).toEqual([
        expect.stringMatching(/^│ ✗ Searching for stdin changes +\d+ms │$/),
        expect.stringMatching(/^│ {3}└▸ fatal: ambiguous argument 'v1\.\.HEAD': unknown revision +│$/),
      ]);

      // Nonzero exits come back as ordinary output ending in "Exit code: N", not as error results
      const exited = make(
        { command: 'echo about to fail && ls /nope', description: 'Running a command that fails on purpose' },
        { text: 'stdout:\nabout to fail\n\nstderr:\nls: /nope: No such file or directory\n\nExit code: 1' },
      );
      exited.setCompactToolContinuation(true);
      exited.setCompactToolHasFollowingContinuation(true);
      expect(lines(exited)).toEqual([
        expect.stringMatching(/^│ ✗ Running a command that fails on purpose +\d+ms │$/),
        expect.stringMatching(/^│ {3}└▸ ls: \/nope: No such file or directory +│$/),
      ]);

      // Without stderr or an error-looking line, the last output line is unrelated to the failure
      const quietFailure = make(
        {
          command: "gh api graphql; echo ====; gh run view 1 --log-failed | rg -v '^$'",
          description: 'Listing threads',
        },
        { text: 'resolved=false a.ts:1 :: a comment that mentions an error\n====\n\nExit code: 1' },
      );
      quietFailure.setCompactToolContinuation(true);
      quietFailure.setCompactToolHasFollowingContinuation(true);
      expect(lines(quietFailure)).toEqual([
        expect.stringMatching(/^│ ✗ Listing threads +\d+ms │$/),
        expect.stringMatching(/^│ {3}└▸ exit code 1 +│$/),
      ]);

      const background = make({ command: 'pnpm dev', description: 'Starting the dev server', background: true });
      background.setBackgroundTaskId('bg-1');
      background.setCompactToolContinuation(true, background.getCompactToolGroupSummary());
      background.setCompactToolHasFollowingContinuation(true);
      expect(lines(background)).toEqual([expect.stringMatching(/^│ ◷ Starting the dev server +started │$/)]);
    });

    it('ticks a running row every second and stops when the run ends', () => {
      vi.useFakeTimers();
      try {
        const running = make({ command: 'sleep 5', description: 'Waiting for the build' });
        expect(lines(running)[3]).toMatch(/^│ [⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Waiting for the build +0s │$/);
        vi.advanceTimersByTime(2_100);
        expect(lines(running)[3]).toMatch(/ 2s │$/);

        running.stopLiveUpdates();
        expect(lines(running)[3]).toMatch(/^│ ■ Waiting for the build +stopped │$/);
        vi.advanceTimersByTime(5_000);
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('uses the command for a row without a description, e.g. one rejected for missing it', () => {
      const rejected = make(
        { command: "cd /tmp/work; sed -i '' 's/a/b/' file.ts\ngrep -c b file.ts" },
        {
          text: JSON.stringify(
            {
              error: true,
              message: 'Tool input validation failed for execute_command.\n- description: Required',
              validationErrors: { fields: {} },
            },
            null,
            2,
          ),
          isError: true,
        },
      );
      expect(rejected.getChatSpacingKind()).toBe('quiet-compact-tool');
      rejected.setCompactToolContinuation(true);
      rejected.setCompactToolHasFollowingContinuation(true);
      expect(lines(rejected)).toEqual([
        expect.stringMatching(/^│ ✗ sed -i '' 's\/a\/b\/' file\.ts +\d+ms │$/),
        expect.stringMatching(/^│ {3}└▸ Tool input validation failed for execute_command\. +│$/),
      ]);
    });

    it('groups at any preview setting, and keeps its own box only when expanded', () => {
      const withPreview = make({ command: 'git log', description: 'Listing later commits' }, { text: 'out 1' }, 2);
      expect(withPreview.getChatSpacingKind()).toBe('quiet-compact-tool');
      expect(withPreview.getQuietShellPreviewLines()).toEqual(['out 1']);
      expect(make({ command: 'git log' }, { text: 'out 1' }, 0).getQuietShellPreviewLines()).toBeUndefined();

      const expanded = make({ command: 'git log', description: 'Listing later commits' }, { text: 'out 1' });
      expanded.setExpanded(true);
      expect(expanded.getChatSpacingKind()).toBe('quiet-shell-tool');
      const text = lines(expanded).join('\n');
      expect(text).toContain('$ git log');
      expect(text).toContain('out 1');
    });

    it('keeps a finished duration fixed when the row is rebuilt later', () => {
      vi.useFakeTimers();
      try {
        const done = make({ command: 'true', description: 'Doing nothing' }, { text: '' });
        const before = lines(done)[3];
        vi.advanceTimersByTime(3_000);
        done.setCompactToolHasFollowingContinuation(true);
        expect(lines(done)[3]).toBe(before);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('renders the quiet description as plain text instead of shell-highlighting it', () => {
    const previousLevel = chalk.level;
    chalk.level = 3;
    try {
      const component = new ToolExecutionComponentEnhanced(
        'execute_command',
        { command: 'git status', description: 'Checking for uncommitted changes' },
        { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 2 },
        ui,
      );
      component.updateResult({ content: [{ type: 'text', text: 'clean' }], isError: false }, false);

      // Shell highlighting colors each word token separately, so the raw line would not contain
      // the description as one contiguous run.
      expect(component.render(80).join('\n')).toContain('Checking for uncommitted changes');

      component.setExpanded(true);
      expect(component.render(80).join('\n')).not.toContain('git status');
      expect(stripAnsi(component.render(80).join('\n'))).toContain('$ git status');
    } finally {
      chalk.level = previousLevel;
    }
  });

  it('falls back to the command when the description is blank', () => {
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command: 'git status', description: '  \n ' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 2 },
      ui,
    );
    component.updateResult({ content: [{ type: 'text', text: 'clean' }], isError: false }, false);

    expect(renderInChat([component])).toContainEqual(expect.stringMatching(/^│ ✓ git status +\d+ms │$/));
  });

  it('strips a leading cd prefix separated by a bare newline and shows the path in the footer', () => {
    // The form callers actually emit: no `&&`, path on its own line, no `cwd` arg.
    const command = [
      'cd /Users/example/code/some-workspace',
      "timeout 400 pnpm exec vitest run src/sandbox/index.test.ts --reporter=dot 2>&1 | grep -E 'Tests '",
    ].join('\n');
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command },
      { quietDisplayMode: 'normal', collapsedByDefault: true },
      ui,
    );
    component.updateResult({ content: [{ type: 'text', text: 'ok' }], isError: false }, false);

    const visible = stripAnsi(component.render(120).join('\n'));
    expect(visible).not.toContain('cd /Users/example');
    expect(visible).toContain('$ timeout 400 pnpm exec vitest');
    expect(visible).toContain('in /Users/example/code/some-workspace');
  });

  it('strips cd prefixes for quoted paths, semicolons, and leading whitespace', () => {
    const cases = [
      ['cd "/Users/example/some path/ws" && npm run build', 'npm run build'],
      ["cd '/Users/example/some path/ws' && npm run build", 'npm run build'],
      ['cd /Users/example/ws; npm run build', 'npm run build'],
      ['  cd /Users/example/ws && npm run build', 'npm run build'],
    ];

    for (const [command, expected] of cases) {
      const component = new ToolExecutionComponentEnhanced(
        'execute_command',
        { command },
        { quietDisplayMode: 'normal', collapsedByDefault: true },
        ui,
      );
      component.updateResult({ content: [{ type: 'text', text: 'ok' }], isError: false }, false);

      const visible = stripAnsi(component.render(120).join('\n'));
      expect(visible).not.toContain('cd ');
      expect(visible).toContain(`$ ${expected}`);
    }
  });

  it('keeps a lone cd command since stripping it would leave nothing to run', () => {
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command: 'cd /Users/example/ws' },
      { quietDisplayMode: 'normal', collapsedByDefault: true },
      ui,
    );
    component.updateResult({ content: [{ type: 'text', text: 'ok' }], isError: false }, false);

    expect(stripAnsi(component.render(120).join('\n'))).toContain('$ cd /Users/example/ws');
  });

  it('shows where the command runs when it has both a cwd arg and a cd prefix', () => {
    const render = (command: string, quietDisplayMode: 'normal' | 'quiet') => {
      const component = new ToolExecutionComponentEnhanced(
        'execute_command',
        { command, cwd: '/Users/example/real-cwd' },
        { quietDisplayMode, collapsedByDefault: true, projectRoot: '/work/repo' },
        ui,
      );
      component.updateResult({ content: [{ type: 'text', text: 'ok' }], isError: false }, false);
      return { component, visible: stripAnsi(component.render(120).join('\n')) };
    };

    // The shell starts in cwd, and an absolute cd moves it elsewhere.
    const absolute = render('cd /Users/example/somewhere-else && npm run build', 'normal').visible;
    expect(absolute).toContain('$ npm run build');
    expect(absolute).toContain('in /Users/example/somewhere-else');
    // A relative cd moves it within cwd.
    expect(render('cd packages/core && npm run build', 'normal').visible).toContain(
      'in /Users/example/real-cwd/packages/core',
    );
    expect(render('cd packages/core && npm run build', 'quiet').component.getCompactToolGroupKey()).toBe(
      '$ /Users/example/real-cwd/packages/core',
    );
    expect(render('npm run build', 'quiet').component.getCompactToolGroupKey()).toBe('$ /Users/example/real-cwd');

    // A relative cd from a home cwd moves from the home directory, not from `~` as literal text.
    const fromHome = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command: 'cd .. && ls', cwd: '~' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true, projectRoot: '/work/repo' },
      ui,
    );
    expect(fromHome.getCompactToolGroupKey()).toBe(`$ ${dirname(homedir())}`);
    fromHome.updateArgs({ command: 'cd ../.. && ls', cwd: '~/a' });
    expect(fromHome.getCompactToolGroupKey()).toBe(`$ ${dirname(homedir())}`);
  });

  it('keeps the error visible when a quiet shell command fails', () => {
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command: 'ls /definitely-not-a-real-path', description: 'Listing a missing path' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 2 },
      ui,
    );
    component.updateResult(
      {
        content: [{ type: 'text', text: 'ls: /definitely-not-a-real-path: No such file or directory' }],
        isError: true,
      },
      false,
    );

    const lines = renderInChat([component]);
    expect(lines).toContainEqual(expect.stringMatching(/^│ ✗ Listing a missing path +\d+ms │$/));
    expect(lines).toContainEqual(expect.stringMatching(/^│ {3}└▸ ls: .*No such file or directory +│$/));
  });

  it('never passes escape sequences from a description, command, cwd, output, or error to the terminal', () => {
    // Cursor moves and a screen clear (CSI), a clipboard write, a title change and a hyperlink (OSC),
    // device control (DCS), an 8-bit CSI, and a stray ESC.
    const hostile = [
      '\x1b[2J\x1b[1A',
      '\x1b]52;c;aGVsbG8=\x07',
      '\x1b]0;pwned\x1b\\',
      '\x1b]8;;https://evil.example\x1b\\',
      '\x1bPpayload\x1b\\',
      '\x9b2J',
      '\x1b=',
    ].join('');
    const injected = [
      '\x1b[2J',
      '\x1b[1A',
      '\x1b]',
      'aGVsbG8=',
      'pwned',
      'evil.example',
      '\x1bP',
      'payload',
      '\x9b',
      '\x1b=',
    ];
    const renderBox = (component: ToolExecutionComponentEnhanced) => {
      const container = new Container();
      container.addChild(component);
      reconcileChatBoundarySpacers(container);
      const raw = container.render(120).join('\n');
      for (const sequence of injected) expect(raw).not.toContain(sequence);
      return stripAnsi(raw)
        .split('\n')
        .map(line => line.trimEnd());
    };

    const described = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command: 'ls', description: `Listing${hostile} files` },
      { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 2 },
      ui,
    );
    described.updateResult(
      {
        content: [{ type: 'text', text: `out${hostile}put\n\nstderr:\nerror: bad${hostile}\n\nExit code: 1` }],
        isError: false,
      },
      false,
    );
    const lines = renderBox(described);
    expect(lines).toContainEqual(expect.stringMatching(/^│ ✗ Listing files +\d+ms │$/));
    expect(lines).toContainEqual(expect.stringMatching(/^│ error: bad +│$/));
    expect(lines).toContainEqual(expect.stringMatching(/^│ {3}└▸ error: bad +│$/));

    // Without a description the row shows the command, and the header shows the cwd argument.
    const bare = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command: `ls${hostile} -la`, cwd: `/tmp/work${hostile}dir` },
      { quietDisplayMode: 'quiet', collapsedByDefault: true, quietPreviewLineLimit: 0 },
      ui,
    );
    bare.updateResult({ content: [{ type: 'text', text: 'ok' }], isError: false }, false);
    const bareLines = renderBox(bare);
    expect(bareLines).toContainEqual(expect.stringMatching(/^│ \$ \/tmp\/workdir +│$/));
    expect(bareLines).toContainEqual(expect.stringMatching(/^│ ✓ ls -la +\d+ms │$/));
  });

  it('keeps quiet shell box borders aligned for long git output', () => {
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command: 'git remote -v' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    const remoteLine = 'fork_truffle-dev    https://github.com/truffle-dev/mastra.git (push)'.repeat(4);

    component.updateResult(
      {
        content: [{ type: 'text', text: remoteLine }],
        isError: false,
      },
      false,
    );

    const rendered = component.render(80);
    const topWidth = visibleWidth(rendered[0]!);
    const boxLines = rendered.filter(line => /^[╭│├╰]/.test(stripAnsi(line)));

    expect(boxLines.length).toBeGreaterThan(1);
    expect(boxLines.every(line => visibleWidth(line) === topWidth)).toBe(true);
    expect(boxLines.every(line => /[╮│┤╯]$/.test(stripAnsi(line).trimEnd()))).toBe(true);
  });

  it('keeps quiet shell box borders aligned for multiline command input', () => {
    const command = `gh pr create --base main --head fix/mastracode-visible-width-truncation --title "fix(mastracode): use visible width for terminal output" --body "This follows up on the quiet-mode terminal rendering work.

It makes ANSI truncation and bordered command output measure terminal display width instead of raw string length, so wide characters and ANSI/OSC closers do not throw off alignment.

Test plan:
- pnpm test src/tui/components/__tests__/ansi.test.ts src/tui/components/__tests__/task-progress.test.ts src/tui/components/__tests__/tool-execution-enhanced.test.ts --bail 1 --reporter=dot"`;
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command },
      { quietDisplayMode: 'normal', collapsedByDefault: true },
      ui,
    );

    const rendered = component.render(100);
    const topWidth = visibleWidth(rendered[0]!);
    const boxLines = rendered.filter(line => /^[╭│╰]/.test(stripAnsi(line)));

    const visible = stripAnsi(rendered.join('\n'));
    expect(visible).toContain('This follows up on the');
    expect(visible).toContain('quiet-mode');
    expect(visible).toContain('rendering work.');
    expect(visible).not.toContain('…');
    expect(boxLines.length).toBeGreaterThan(3);
    expect(boxLines.every(line => visibleWidth(line) === topWidth)).toBe(true);
    expect(boxLines.every(line => /[╮│╯]$/.test(stripAnsi(line).trimEnd()))).toBe(true);
  });

  it('keeps quiet detail lines visible after completion', () => {
    const component = new ToolExecutionComponentEnhanced(
      'write_file',
      {},
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    component.updateArgs({ path: 'src/example.ts', content: 'first line\nsecond line' });

    expect(component.render(100)).toHaveLength(4);

    component.updateResult({ content: [{ type: 'text', text: 'done' }], isError: false }, false);
    const lines = component.render(100);
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain('│');
  });

  it('does not add an output section to a shell box without output and keeps the prompt orange', () => {
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command: 'printf lines' },
      { quietDisplayMode: 'normal', collapsedByDefault: true },
      ui,
    );

    const output = component.render(100).join('\n');
    const visible = stripAnsi(output);
    expect(output).toContain('\u001b[93m$');
    expect(output).not.toContain('⟶');
    expect(visible).not.toContain('├');
    expect(visible.split('\n')).toHaveLength(3);
  });

  it('syntax highlights shell command footers as bash', () => {
    const command = 'if [ -f package.json ]; then echo "ok"; fi';
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command },
      { quietDisplayMode: 'normal', collapsedByDefault: true },
      ui,
    );

    const output = component.render(100).join('\n');
    expect(stripAnsi(output)).toContain(`$ ${command}`);
    expect(output).toContain(chalk.blue('if'));
    expect(output).toContain(theme.fg('toolArgs', 'echo'));
    expect(output).toContain(theme.fg('toolArgs', '-f'));
  });

  it('shows the full growing shell command while bounding syntax highlighting', () => {
    const command = `printf START-${'x'.repeat(2_100)}-then-LATEST`;
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command: 'printf START-' },
      { quietDisplayMode: 'normal', collapsedByDefault: true },
      ui,
    );

    component.updateArgs({ command }, true);

    const output = component.render(100).join('\n');
    const visible = stripAnsi(output);
    expect(visible).toContain('START-');
    expect(visible).toContain('LATEST');
    expect(visible).not.toContain('…');
    expect(output).not.toContain(chalk.blue('then'));
  });

  it('keeps shell keywords inside quoted strings highlighted as strings', () => {
    const command = 'echo "if then fi" && printf \'done\'';
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command },
      { quietDisplayMode: 'normal', collapsedByDefault: true },
      ui,
    );

    const output = component.render(100).join('\n');
    expect(stripAnsi(output)).toContain(command);
    expect(output).toContain(chalk.white('"if then fi"'));
    expect(output).not.toContain(chalk.blue('then'));
    expect(output).toContain(chalk.white("'done'"));
  });

  it('closes double quotes after an even run of backslashes', () => {
    const command = 'echo "path\\\\" && then';
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command },
      { quietDisplayMode: 'normal', collapsedByDefault: true },
      ui,
    );

    const output = component.render(100).join('\n');
    expect(stripAnsi(output)).toContain(command);
    expect(output).toContain(chalk.white('"path\\\\"'));
    expect(output).toContain(chalk.blue('then'));
  });

  it('highlights shell control words and numbers outside quoted strings', () => {
    const command = 'for item in 1 2 3; do echo "while 99"; done';
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command },
      { quietDisplayMode: 'normal', collapsedByDefault: true },
      ui,
    );

    const output = component.render(100).join('\n');
    expect(stripAnsi(output)).toContain(command);
    expect(output).toContain(chalk.blue('for'));
    expect(output).toContain(chalk.blue('in'));
    expect(output).toContain(chalk.white('1'));
    expect(output).toContain(chalk.white('3'));
    expect(output).toContain(chalk.white('"while 99"'));
    expect(output).not.toContain(chalk.blue('while'));
  });

  it('keeps quoted shell strings highlighted after wrapping', () => {
    const command = `echo "${'quoted '.repeat(40)}if then fi"`;
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command },
      { quietDisplayMode: 'normal', collapsedByDefault: true },
      ui,
    );

    const output = component.render(80).join('\n');
    const footerLines = stripAnsi(output)
      .split('\n')
      .filter(line => line.startsWith('│') && line.trim() !== '│');
    expect(footerLines.length).toBeGreaterThan(1);
    expect(stripAnsi(output)).toContain('then');
    expect(stripAnsi(output)).toContain('fi"');
    expect(output).not.toContain(chalk.blue('then'));
  });

  it('preserves standalone ampersands in shell command footers', () => {
    const command = 'sleep 1 & wait && echo ok 2>&1';
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command },
      { quietDisplayMode: 'normal', collapsedByDefault: true },
      ui,
    );

    const output = component.render(100).join('\n');
    expect(stripAnsi(output)).toContain(command);
    expect(output).toContain(theme.fg('muted', '&'));
    expect(output).toContain(theme.fg('muted', '>'));
  });

  it('wraps long shell commands in the footer instead of truncating them', () => {
    const command =
      'pnpm --filter mastracode exec vitest run src/tui/components/__tests__/tool-execution-enhanced.test.ts --bail 1 --reporter=dot';
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command },
      { quietDisplayMode: 'normal', collapsedByDefault: true },
      ui,
    );

    const output = stripAnsi(component.render(60).join('\n'));
    const footerLines = output.split('\n').filter(line => line.startsWith('│') && line.trim() !== '│');
    expect(output).not.toContain('…');
    expect(output).toContain('--reporter=dot');
    expect(footerLines.length).toBeGreaterThan(1);
    expect(footerLines[0]).toContain('│ $ pnpm');
    expect(footerLines[1]).toMatch(/^│   \S/);
  });

  it('keeps base shell command color on wrapped continuation lines', () => {
    const command =
      'pnpm --filter mastracode exec vitest run src/tui/components/__tests__/tool-execution-enhanced.test.ts --bail 1 --reporter=dot && pnpm --filter mastracode lint && pnpm --filter mastracode check';
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command },
      { quietDisplayMode: 'normal', collapsedByDefault: true },
      ui,
    );

    const output = component.render(120).join('\n');
    const wrappedLine = output.split('\n').find(line => stripAnsi(line).includes('lint && pnpm --filter'));
    expect(wrappedLine).toContain(theme.fg('toolArgs', 'lint'));
  });

  it('shows same-file continuation paths while edit args are still streaming', () => {
    const first = new ToolExecutionComponentEnhanced(
      'string_replace_lsp',
      { path: 'packages/app/src/example.ts', old_string: 'a', new_string: 'b' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    first.updateResult(
      { content: [{ type: 'text', text: 'Edited packages/app/src/example.ts (lines 4-4)' }], isError: false },
      false,
    );

    const second = new ToolExecutionComponentEnhanced(
      'string_replace_lsp',
      { path: 'packages/app/src/example.ts', old_string: 'b', new_string: 'c' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    second.setCompactToolContinuation(true, 'packages/app/src/example.ts:4-4');

    const visible = stripAnsi(second.render(100).join('\n'));
    expect(visible).toContain('src/example.ts');
    expect(visible).toMatch(/●─+ \/src\/example\.ts/);
    expect(visible).not.toMatch(/^\s*[●├─ ]+$/m);

    second.updateResult(
      {
        content: [{ type: 'text', text: 'Replaced 1 occurrence in packages/app/src/example.ts (lines 8-8)' }],
        isError: false,
      },
      false,
    );
    second.setCompactToolContinuation(true, 'packages/app/src/example.ts:4-4');
    const completedVisible = stripAnsi(second.render(100).join('\n'));
    expect(completedVisible).toContain('src/example.ts:8-8');
    expect(completedVisible).toMatch(/●─+ \/src\/example\.ts:8-8/);
  });

  it('keeps same-file continuation connector geometry when both edits have line ranges', () => {
    const component = new ToolExecutionComponentEnhanced(
      'string_replace_lsp',
      {
        path: '/tmp/project/apps/web/src/features/checkout/components/payment-method-selector.ts',
        new_string: 'const suffix = true;',
      },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    component.updateResult(
      {
        content: [
          {
            type: 'text',
            text: 'Replaced 1 occurrence in /tmp/project/apps/web/src/features/checkout/components/payment-method-selector.ts (lines 38-43)',
          },
        ],
        isError: false,
      },
      false,
    );
    component.setCompactToolContinuation(
      true,
      '/tmp/project/apps/web/src/features/checkout/components/payment-method-selector.ts:26-29',
    );

    const visible = stripAnsi(component.render(220).join('\n'));
    expect(visible).toContain('/components/payment-metho');
    expect(visible).toMatch(/●─+ \/components\/payment-metho/);
  });

  it('renders standalone incomplete continuations with a tool label instead of a blank call', () => {
    const component = new ToolExecutionComponentEnhanced(
      'string_replace_lsp',
      {},
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    component.setCompactToolContinuation(true);

    const visible = stripAnsi(component.render(100).join('\n'));
    expect(visible).toContain('edit');
    expect(visible.trim()).not.toBe('');
  });

  it('renders grouped empty continuations as a dot instead of flashing the tool label', () => {
    const component = new ToolExecutionComponentEnhanced(
      'string_replace_lsp',
      {},
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    component.setCompactToolContinuation(
      true,
      '/tmp/project/apps/web/src/features/checkout/components/payment-method-selector.ts:26-29',
    );

    const firstLine = stripAnsi(component.render(120)[0] ?? '');
    expect(firstLine).toContain('●─');
    expect(firstLine).not.toContain('edit');
  });

  it('does not render connector-only continuation headers when summaries fully overlap', () => {
    const component = new ToolExecutionComponentEnhanced(
      'string_replace_lsp',
      { path: 'mastracode/src/tui/handlers/tool.ts', new_string: 'reconcileToolBoundaries(ctx);' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    component.setCompactToolContinuation(true, 'mastracode/src/tui/handlers/tool.ts');

    const lines = stripAnsi(component.render(120).join('\n')).split('\n');
    expect(lines[0]).toContain('/handlers/tool.ts');
    expect(lines[0]).not.toMatch(/^\s*[●╰├─ ]+▌?\s*$/);
  });

  it('renders quiet non-shell failures in compact style with error detail', () => {
    const component = new ToolExecutionComponentEnhanced(
      'string_replace_lsp',
      { path: 'src/example.ts', old_string: 'missing', new_string: 'replacement' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    component.updateResult({ content: [{ type: 'text', text: 'Error: missing replacement' }], isError: true }, false);

    const output = component.render(100).join('\n');
    const visible = stripAnsi(output);
    expect(visible).toContain('edit');
    expect(visible).toContain('src/example.ts');
    expect(visible).toContain('✗');
    expect(visible).toContain('Error: missing replacement');
    expect(visible).not.toContain('╭──');
  });

  it('renders browser tools without duplicating args as preview lines', () => {
    const component = new ToolExecutionComponentEnhanced(
      'browser_goto',
      { url: 'https://example.com' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    component.updateResult({ content: [{ type: 'text', text: 'navigated' }], isError: false }, false);

    const visible = stripAnsi(component.render(100).join('\n'));
    expect(visible).toContain('browser_goto');
    expect(visible).toContain('https://example.com');
    expect(visible.split('https://example.com')).toHaveLength(2);
    expect(visible).not.toContain('url=');
  });

  it('unwraps browser evaluate and snapshot results instead of showing success JSON', () => {
    const evaluate = new ToolExecutionComponentEnhanced(
      'browser_evaluate',
      { script: 'document.title' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    evaluate.updateResult(
      {
        content: [{ type: 'text', text: '{"success":true,"result":{"title":"","url":"about:blank"}}' }],
        isError: false,
      },
      false,
    );

    const snapshot = new ToolExecutionComponentEnhanced(
      'browser_snapshot',
      { interactiveOnly: false, maxDepth: 3 },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    snapshot.updateResult(
      { content: [{ type: 'text', text: '{"success":true,"snapshot":"- button Demo"}' }], isError: false },
      false,
    );

    const output = stripAnsi(`${evaluate.render(120).join('\n')}\n${snapshot.render(120).join('\n')}`);
    expect(output).toContain('title: ""');
    expect(output).toContain('url: about:blank');
    expect(output).toContain('- button Demo');
    expect(output).not.toContain('"success"');
    expect(output).not.toContain('{');
  });

  it('renders process file stat and generic result previews', () => {
    const processOutput = new ToolExecutionComponentEnhanced(
      'get_process_output',
      { pid: '1234' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    processOutput.updateResult(
      { content: [{ type: 'text', text: 'quiet-process-demo-1\nquiet-process-demo-2' }], isError: false },
      false,
    );

    const stat = new ToolExecutionComponentEnhanced(
      'file_stat',
      { path: 'src/example.ts' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    stat.updateResult(
      {
        content: [{ type: 'text', text: 'src/example.ts Type: file Size: 123 bytes Modified: today' }],
        isError: false,
      },
      false,
    );

    const generic = new ToolExecutionComponentEnhanced(
      'custom_tool',
      { file: 'src/example.ts', line: 1 },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    generic.updateResult({ content: [{ type: 'text', text: '{"action":"exit","count":2}' }], isError: false }, false);

    const visible = stripAnsi(
      `${processOutput.render(120).join('\n')}\n${stat.render(120).join('\n')}\n${generic.render(120).join('\n')}`,
    );
    expect(visible).toContain('process');
    expect(visible).toContain('1234');
    expect(visible).toContain('quiet-process-demo-1');
    expect(visible).toContain('stat');
    expect(visible).toContain('Type: file Size: 123 bytes Modified: today');
    expect(visible).toContain('custom_tool');
    expect(visible).toContain('action: exit');
    expect(visible).toContain('count: 2');
  });

  it('uses the active continuation dot while a continuation is still streaming', () => {
    const component = new ToolExecutionComponentEnhanced(
      'write_file',
      { path: 'src/example.ts' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    component.setCompactToolContinuation(true, 'src/other.ts');

    const visible = stripAnsi(component.render(120).join('\n'));
    expect(visible).toContain('●─');
    expect(visible).not.toContain('╰─');
  });

  it('renders deliberate browser skill workspace and process summaries', () => {
    const cases: Array<[string, Record<string, unknown>, string[]]> = [
      ['browser_type', { ref: 'e12', text: 'hello' }, ['browser_type', 'e12', '"hello"']],
      [
        'skill_read',
        { skillName: 'mastra-docs', path: 'references/style.md' },
        ['skill_read', 'mastra-docs references/style.md'],
      ],
      ['file_stat', { path: 'src/example.ts' }, ['stat', 'src/example.ts']],
      ['get_process_output', { pid: '1234' }, ['process', '1234']],
      ['ast_smart_edit', { path: 'src/example.ts', transform: 'rename' }, ['ast_edit', 'src/example.ts']],
    ];

    for (const [toolName, args, expectedParts] of cases) {
      const component = new ToolExecutionComponentEnhanced(
        toolName,
        args,
        { quietDisplayMode: 'quiet', collapsedByDefault: true },
        ui,
      );
      const visible = stripAnsi(component.render(120).join('\n'));
      for (const expected of expectedParts) expect(visible).toContain(expected);
      expect(visible).not.toContain('path=');
      expect(visible).not.toContain('pid=');
    }
  });
});

describe('parseErrorFromContent', () => {
  it('parses a standard Error: message line', () => {
    const err = parseErrorFromContent('TypeError: cannot read property x of undefined');
    expect(err).not.toBeNull();
    expect(err!.name).toBe('TypeError');
    expect(err!.message).toBe('cannot read property x of undefined');
  });

  it('matches the legacy "type names" the old regex accepted', () => {
    // The original pattern was /^([A-Z][a-zA-Z]*Error):\s*(.+)$/m, so only
    // error names made of ASCII letters were ever matched. These should
    // still match.
    for (const name of ['TypeError', 'RangeError', 'SyntaxError', 'ZodError', 'MyCustomError']) {
      const err = parseErrorFromContent(`${name}: boom`);
      expect(err?.name).toBe(name);
      expect(err?.message).toBe('boom');
    }
  });

  it('does not match names the original regex also rejected', () => {
    // Digits and underscores were never part of the original class.
    // Verifying here so a future loosening is a conscious decision.
    expect(parseErrorFromContent('HTTP404Error: x')).toBeNull();
    expect(parseErrorFromContent('My_CustomError: x')).toBeNull();
    expect(parseErrorFromContent('lowercaseError: x')).toBeNull();
  });

  it('preserves whitespace-only messages (matches legacy behaviour)', () => {
    // The old regex matched `TypeError:   ` with message = " ". We keep
    // that behaviour so any downstream rendering stays stable.
    const err = parseErrorFromContent('TypeError:   ');
    expect(err).not.toBeNull();
    expect(err!.name).toBe('TypeError');
    expect(err!.message).toBe(' ');
  });

  it('extracts stack frames when present', () => {
    const content = ['TypeError: boom', '    at foo (file.ts:10:5)', '    at bar (file.ts:20:5)'].join('\n');
    const err = parseErrorFromContent(content);
    expect(err?.stack).toContain('at foo (file.ts:10:5)');
    expect(err?.stack).toContain('at bar (file.ts:20:5)');
  });

  it('returns null for non-error content', () => {
    expect(parseErrorFromContent('some random text')).toBeNull();
    expect(parseErrorFromContent('')).toBeNull();
    expect(parseErrorFromContent('Error')).toBeNull(); // missing ':'
  });

  it('runs in linear time on pathological inputs (no ReDoS)', () => {
    // Pathological inputs CodeQL flagged: many tabs/spaces after the
    // separator, and long non-error content — both should complete fast.
    // Warm up to avoid JIT noise on slower CI runners.
    parseErrorFromContent('AError:' + '\t'.repeat(1000));
    const budget = process.env.CI ? 1500 : 500;

    const cases = [
      'AError:' + '\t'.repeat(50_000),
      'AError:' + ' '.repeat(50_000) + 'x',
      'AError:' + 'x'.repeat(50_000),
    ];
    for (const input of cases) {
      const start = performance.now();
      parseErrorFromContent(input);
      expect(performance.now() - start).toBeLessThan(budget);
    }
  });
});

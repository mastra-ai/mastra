import { visibleWidth } from '@earendil-works/pi-tui';
import chalk from 'chalk';
import { describe, it, expect } from 'vitest';
import { theme, tintHex, ensureTerminalGlyphContrast } from '../../theme.js';
import { ToolExecutionComponentEnhanced, parseErrorFromContent } from '../tool-execution-enhanced.js';

const ui = { requestRender() {} } as any;

function stripAnsi(text: string): string {
  return text
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\u001b\]8;;[^\u0007]*\u0007/g, '')
    .replace(/\u001b\]8;;\u0007/g, '');
}

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

  it('limits quiet shell output to fifteen content lines', () => {
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command: 'printf lines' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.updateResult(
      {
        content: [{ type: 'text', text: Array.from({ length: 16 }, (_, i) => `line ${i + 1}`).join('\n') }],
        isError: false,
      },
      false,
    );

    const output = component.render(100).join('\n');
    const lines = output.split('\n');
    expect(output).toContain(theme.fg('success', ' ✓'));
    expect(output).toContain('line 2');
    expect(output).toContain('line 16');
    expect(lines.some(line => line.includes('line 1 ') || line.includes('line 1│'))).toBe(false);
    expect(lines.filter(line => line.includes('line '))).toHaveLength(15);
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
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
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

  it('does not add a preview line to quiet shell tools and keeps the prompt orange', () => {
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command: 'printf lines' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    const output = component.render(100).join('\n');
    const visible = stripAnsi(output);
    expect(output).toContain('\u001b[93m$');
    expect(output).not.toContain('⟶');
    expect(visible).not.toContain('├');
    expect(visible.split('\n')).toHaveLength(3);
  });

  it('syntax highlights quiet shell command footers as bash', () => {
    const command = 'if [ -f package.json ]; then echo "ok"; fi';
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
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
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
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
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
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
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
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
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
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
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
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

  it('preserves standalone ampersands in quiet shell command footers', () => {
    const command = 'sleep 1 & wait && echo ok 2>&1';
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    const output = component.render(100).join('\n');
    expect(stripAnsi(output)).toContain(command);
    expect(output).toContain(theme.fg('muted', '&'));
    expect(output).toContain(theme.fg('muted', '>'));
  });

  it('wraps long quiet shell commands in the footer instead of truncating them', () => {
    const command =
      'pnpm --filter mastracode exec vitest run src/tui/components/__tests__/tool-execution-enhanced.test.ts --bail 1 --reporter=dot';
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
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
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
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

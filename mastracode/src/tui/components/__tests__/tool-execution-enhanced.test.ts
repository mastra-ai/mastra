import { describe, it, expect } from 'vitest';
import { theme } from '../../theme.js';
import { ToolExecutionComponentEnhanced, parseErrorFromContent } from '../tool-execution-enhanced.js';

const ui = { requestRender() {} } as any;

function stripAnsi(text: string): string {
  return text
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\u001b\]8;;[^\u0007]*\u0007/g, '')
    .replace(/\u001b\]8;;\u0007/g, '');
}

describe('ToolExecutionComponentEnhanced quiet display', () => {
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
    expect(output).toContain('src/example.ts');
    expect(output).toContain(theme.fg('dim', ':10-14'));
    expect(output).not.toContain('path=');
    expect(output).not.toContain('✓');
    expect(output).not.toContain('╭──');
    expect(visible).toContain('│ const first = 1;');
    expect(visible).toContain('│ const second = 2;');
    expect(visible).toContain('╰──');
    expect(output.split('\n')).toHaveLength(4);
  });

  it('wraps quiet view previews before applying ANSI syntax highlighting', () => {
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
    const withoutCompleteAnsiSequences = output.replace(/\u001b\[[0-9;]*m/g, '');
    expect(withoutCompleteAnsiSequences).not.toContain('\u001b');
    expect(stripAnsi(output)).toContain('│ const value =');
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

    const output = stripAnsi(component.render(100).join('\n'));
    expect(output).toContain('list src (5 results)');
    expect(output).not.toContain('│ .');
    expect(output).toContain('│ src/a.ts');
    expect(output).toContain('│ src/b.ts');
    expect(output).not.toContain('src/c.ts');
    expect(output).toContain('╰──');
  });

  it('colors quiet compact tool labels by status', () => {
    const active = new ToolExecutionComponentEnhanced(
      'view',
      { path: 'src/example.ts' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    expect(active.render(100).join('\n')).toContain(`\u001b[93mview`);

    const complete = new ToolExecutionComponentEnhanced(
      'view',
      { path: 'src/example.ts' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );
    complete.updateResult({ content: [{ type: 'text', text: 'done' }], isError: false });
    expect(complete.render(100).join('\n')).toContain(`\u001b[93mview`);
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
    expect(output).toContain('Tool validation failed: ask_user');
    expect(output).toContain('Parameter: question');
    expect(output).toContain('Required parameter is missing');
    expect(output).toContain('Make sure to provide a "question" parameter');
    expect(output).not.toMatch(/^ask_user .*✗$/m);
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
    expect(output).toContain('╭──');
    expect(output).toContain('edit src/example.ts');
    expect(output).toContain('✗');
    expect(output).not.toMatch(/^edit .*✗$/m);
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
    expect(output).toContain('edit');
    expect(output).toContain('src/example.ts');
    expect(output).toContain(theme.fg('dim', ':42-44'));
    expect(stripAnsi(output)).toContain('new');
    expect(stripAnsi(output)).not.toContain('old →');
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
    expect(lines).toHaveLength(1);

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
    expect(lines[0]).toContain('write /tmp/example.ts');
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
    expect(stripAnsi(lines[0]!)).toContain('├─');
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
    expect(lines[0]).not.toContain('├─');
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
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('│ const first = 1;');
    expect(lines[2]).toContain('│ const second = 2;');
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
    expect(lines[1]).toContain('foo');
    expect(stripAnsi(lines[2]!)).toContain('╰──');

    component.updateArgs({ pattern: 'foo', path: 'src/**/*.ts' });
    lines = component.render(100);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('src/**/*.ts');
    expect(lines[0]).not.toContain('foo');
    expect(lines[1]).toContain('│');
    expect(lines[1]).toContain('foo');
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

  it('limits quiet shell output to eight content lines', () => {
    const component = new ToolExecutionComponentEnhanced(
      'execute_command',
      { command: 'printf lines' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    component.updateResult(
      {
        content: [{ type: 'text', text: Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n') }],
        isError: false,
      },
      false,
    );

    const output = component.render(100).join('\n');
    expect(output).toContain('line 3');
    expect(output).toContain('line 10');
    expect(output).not.toContain('line 2');
    expect(output.split('\n').filter(line => line.includes('│'))).toHaveLength(8);
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
    expect(output).toContain('\u001b[93m$');
    expect(output).not.toContain('⟶');
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

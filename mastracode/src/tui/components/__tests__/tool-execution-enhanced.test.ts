import { describe, it, expect } from 'vitest';
import { ToolExecutionComponentEnhanced, parseErrorFromContent } from '../tool-execution-enhanced.js';

const ui = { requestRender() {} } as any;

describe('ToolExecutionComponentEnhanced quiet display', () => {
  it('renders non-shell quiet tools as a single summary line', () => {
    const component = new ToolExecutionComponentEnhanced(
      'view',
      { path: 'src/example.ts' },
      { quietDisplayMode: 'quiet', collapsedByDefault: true },
      ui,
    );

    const output = component.render(100).join('\n');
    expect(output).toContain('view');
    expect(output).toContain('path=');
    expect(output).not.toContain('╭──');
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

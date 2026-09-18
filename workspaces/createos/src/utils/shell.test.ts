import { describe, expect, it } from 'vitest';

import { buildProcessInvocation, shellQuote } from './shell';

describe('CreateOS shell invocation', () => {
  it('quotes environment values and keeps the user command in argv', () => {
    const invocation = buildProcessInvocation('printf "%s" "$TOKEN"', {
      cwd: '/work tree',
      env: { TOKEN: "it's-safe" },
    });

    expect(invocation.cmd).toBe('bash');
    expect(invocation.args).toEqual([
      '-lc',
      `export TOKEN='it'\\''s-safe'\ncd -- '/work tree'\nexec bash -lc "$1"`,
      'mastra',
      'printf "%s" "$TOKEN"',
    ]);
  });

  it('rejects invalid environment names', () => {
    expect(() => buildProcessInvocation('true', { env: { 'BAD-NAME': 'value' } })).toThrow(
      'Invalid environment variable name: BAD-NAME',
    );
  });

  it('quotes single quotes', () => {
    expect(shellQuote("a'b")).toBe("'a'\\''b'");
  });
});

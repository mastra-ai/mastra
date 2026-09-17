import { describe, expect, it } from 'vitest';
import { buildArgs } from './transform';

describe('buildArgs', () => {
  it('passes an explicit verbosity level to jscodeshift', () => {
    const args = buildArgs('/path/to/transform.js', '/path/to/source', { verbose: true });

    expect(args).toContain('--verbose=2');
    expect(args).not.toContain('--verbose');
  });

  it('omits the verbosity option when verbose mode is disabled', () => {
    const args = buildArgs('/path/to/transform.js', '/path/to/source', { verbose: false });

    expect(args.some(arg => arg.startsWith('--verbose'))).toBe(false);
  });
});

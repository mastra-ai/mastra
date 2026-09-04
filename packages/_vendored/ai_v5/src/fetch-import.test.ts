import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageDirectory = fileURLToPath(new URL('..', import.meta.url));

describe('@ai-sdk/provider-utils initialization', () => {
  it('imports when global fetch is not callable', () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ['--input-type=module', '--eval', "globalThis.fetch = undefined; await import('@ai-sdk/provider-utils');"],
        { cwd: packageDirectory, stdio: 'pipe' },
      ),
    ).not.toThrow();
  });
});

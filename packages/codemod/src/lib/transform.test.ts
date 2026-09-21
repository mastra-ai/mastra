import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transform } from './transform';

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(
    (
      _file: string,
      _args: string[],
      _options: { encoding: string },
      callback: (error: null, result: { stdout: string; stderr: string }) => void,
    ) => callback(null, { stdout: '', stderr: '' }),
  ),
}));

vi.mock('node:child_process', () => ({
  default: { execFile: execFileMock },
}));

vi.mock('node:module', () => ({
  createRequire: () => ({ resolve: () => '/jscodeshift.js' }),
}));

vi.mock('debug', () => ({
  default: () => vi.fn(),
}));

describe('transform', () => {
  beforeEach(() => {
    execFileMock.mockClear();
  });

  it('rejects unknown codemod names', async () => {
    await expect(transform('v1/does-not-exist', '.', {}, { logStatus: false })).rejects.toThrow(
      'Unknown codemod "v1/does-not-exist". Available codemods: v1/mastra-core-imports',
    );
  });

  it('anchors the hidden-directory ignore pattern to the target', async () => {
    const source = '/tmp/.worktrees/project';

    await transform('v1/runtime-context', source, {}, { logStatus: false });

    const childArgs = execFileMock.mock.calls[0]![1];
    expect(childArgs).toContain(`--ignore-pattern=${path.join(path.resolve(source), '**/.*/**')}`);
    expect(childArgs).not.toContain('--ignore-pattern=**/.*/**');
  });
});

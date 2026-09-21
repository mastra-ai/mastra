import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transform } from './transform';

const { execFileMock, jscodeshiftOutput } = vi.hoisted(() => {
  const jscodeshiftOutput = 'Processing 1 files...\nconst result = memory.recall();\nResults:\n1 ok\n';

  return {
    jscodeshiftOutput,
    execFileMock: vi.fn(
      (
        _file: string,
        _args: string[],
        _options: { encoding: string },
        callback: (error: null, result: { stdout: string; stderr: string }) => void,
      ) => callback(null, { stdout: jscodeshiftOutput, stderr: '' }),
    ),
  };
});

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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unknown codemod names', async () => {
    await expect(transform('v1/does-not-exist', '.', {}, { logStatus: false })).rejects.toThrow(
      'Unknown codemod "v1/does-not-exist". Available codemods: v1/mastra-core-imports',
    );
  });

  it('forwards jscodeshift output for individual transforms', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await transform('v1/runtime-context', '.', {}, { logStatus: true });

    expect(stdoutWriteSpy).toHaveBeenCalledWith(jscodeshiftOutput);
  });

  it.each([
    ['dry', { dry: true }],
    ['print', { print: true }],
    ['verbose', { verbose: true }],
  ] as const)('forwards jscodeshift output for %s runs without status logging', async (_name, transformOptions) => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await transform('v1/runtime-context', '.', transformOptions, { logStatus: false });

    expect(stdoutWriteSpy).toHaveBeenCalledWith(jscodeshiftOutput);
  });

  it('keeps routine bundled transforms quiet', async () => {
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await transform('v1/runtime-context', '.', {}, { logStatus: false });

    expect(stdoutWriteSpy).not.toHaveBeenCalled();
  });
});

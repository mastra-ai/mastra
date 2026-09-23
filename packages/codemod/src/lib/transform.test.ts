import path from 'node:path';
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

  it('anchors the hidden-directory ignore pattern to the target', async () => {
    const source = '/tmp/.worktrees/project';

    await transform('v1/runtime-context', source, {}, { logStatus: false });

    const childArgs = execFileMock.mock.calls[0]![1];
    expect(childArgs).toContain(`--ignore-pattern=${path.join(path.resolve(source), '**/.*/**')}`);
    expect(childArgs).not.toContain('--ignore-pattern=**/.*/**');
  });

  it('reports each transformation error with its matching file and message', async () => {
    execFileMock.mockImplementationOnce((_file, _args, _options, callback) =>
      callback(null, {
        stdout: [
          'Processing 2 files...',
          " ERR /project/boom.ts Transformation error (Cannot read properties of undefined (reading 'name'))",
          "TypeError: Cannot read properties of undefined (reading 'name')",
          '    at transformer (/transforms/example.js:6:11)',
          ' ERR /project/syntax.ts Transformation error (Unexpected token (1:13))',
          'SyntaxError: Unexpected token (1:13)',
          '    at toParseError (/parser/parse-error.ts:96:45)',
          'Results:',
          '2 errors',
        ].join('\n'),
        stderr: '',
      }),
    );

    const result = await transform('v1/runtime-context', '.', {}, { logStatus: false });

    expect(result.errors).toEqual([
      {
        transform: 'v1/runtime-context',
        filename: '/project/boom.ts',
        summary: "Cannot read properties of undefined (reading 'name')",
      },
      {
        transform: 'v1/runtime-context',
        filename: '/project/syntax.ts',
        summary: 'Unexpected token (1:13)',
      },
    ]);
  });
});

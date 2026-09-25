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

  describe('error parsing', () => {
    const run = async (stdout: string) => {
      execFileMock.mockImplementationOnce((_f, _a, _o, callback) => callback(null, { stdout, stderr: '' }));
      return transform('v1/runtime-context', '.', {}, { logStatus: false });
    };

    it('reports non-syntax transform failures', async () => {
      const { errors } = await run(
        "Processing 1 files...\n ERR /src/boom.ts Transformation error (Cannot read properties of undefined (reading 'x'))\nTypeError: Cannot read properties of undefined (reading 'x')\n    at foo\nResults:\n1 errors\n",
      );
      expect(errors).toEqual([
        {
          transform: 'v1/runtime-context',
          filename: '/src/boom.ts',
          summary: "Cannot read properties of undefined (reading 'x')",
        },
      ]);
    });

    it('reports syntax errors', async () => {
      const { errors } = await run(
        ' ERR /src/bad.ts Transformation error (Unexpected token (1:13))\nSyntaxError: Unexpected token (1:13)\n',
      );
      expect(errors).toEqual([
        { transform: 'v1/runtime-context', filename: '/src/bad.ts', summary: 'Unexpected token (1:13)' },
      ]);
    });

    it('attributes each error in mixed runs to its own file', async () => {
      const { errors } = await run(
        [
          ' ERR /src/boom.ts Transformation error (boom)',
          'TypeError: boom',
          '    at transform',
          ' ERR /src/bad.ts Transformation error (Unexpected token (1:13))',
          'SyntaxError: Unexpected token (1:13)',
          'Results:',
          '2 errors',
        ].join('\n'),
      );
      expect(errors).toEqual([
        { transform: 'v1/runtime-context', filename: '/src/boom.ts', summary: 'boom' },
        { transform: 'v1/runtime-context', filename: '/src/bad.ts', summary: 'Unexpected token (1:13)' },
      ]);
    });

    it('returns no errors for successful runs', async () => {
      const { errors } = await run(jscodeshiftOutput);
      expect(errors).toEqual([]);
    });
  });
});

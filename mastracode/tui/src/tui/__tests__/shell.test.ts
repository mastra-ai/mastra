import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createShellPassthroughSubprocess } from '../shell-runner.js';

const { execaMock } = vi.hoisted(() => ({
  execaMock: vi.fn(),
}));

vi.mock('execa', () => ({
  execa: execaMock,
}));

describe('createShellPassthroughSubprocess', () => {
  beforeEach(() => {
    execaMock.mockReset();
    execaMock.mockReturnValue(Promise.resolve({ exitCode: 0 }));
  });

  it('preserves the existing execa shell:true shape for default mode', async () => {
    const { invocation } = await createShellPassthroughSubprocess(
      'echo ok',
      { mode: 'default' },
      { CUSTOM_ENV: 'present' },
      'darwin',
    );

    expect(invocation.kind).toBe('default');
    expect(execaMock).toHaveBeenCalledTimes(1);
    expect(execaMock).toHaveBeenCalledWith(
      'echo ok',
      expect.objectContaining({
        shell: true,
        reject: false,
        timeout: 30_000,
        env: expect.objectContaining({ CUSTOM_ENV: 'present', FORCE_COLOR: '1' }),
      }),
    );
  });

  it('uses shell:false with executable and args for explicit shell mode', async () => {
    const { invocation } = await createShellPassthroughSubprocess(
      'echo ok',
      { mode: 'path', executable: '/bin/zsh' },
      {},
      'darwin',
    );

    expect(invocation).toMatchObject({
      kind: 'explicit',
      executable: '/bin/zsh',
      args: ['-c', 'echo ok'],
    });
    expect(execaMock).toHaveBeenCalledTimes(1);
    expect(execaMock).toHaveBeenCalledWith(
      '/bin/zsh',
      ['-c', 'echo ok'],
      expect.objectContaining({
        shell: false,
        reject: false,
        timeout: 30_000,
        env: expect.objectContaining({ FORCE_COLOR: '1' }),
      }),
    );
  });

  it('passes an injected cwd through to execa', async () => {
    await createShellPassthroughSubprocess('echo ok', { mode: 'default' }, {}, 'darwin', '/tmp/work');

    expect(execaMock).toHaveBeenCalledWith(
      'echo ok',
      expect.objectContaining({
        cwd: '/tmp/work',
      }),
    );
  });

  it('uses Windows verbatim arguments for explicit cmd mode', async () => {
    const { invocation } = await createShellPassthroughSubprocess(
      'echo "hi" & dir',
      { mode: 'path', executable: 'cmd.exe' },
      {},
      'win32',
    );

    expect(invocation).toMatchObject({
      kind: 'explicit',
      executable: 'cmd.exe',
      args: ['/d', '/s', '/c', '"echo "hi" & dir"'],
    });
    expect(execaMock).toHaveBeenCalledWith(
      'cmd.exe',
      ['/d', '/s', '/c', '"echo "hi" & dir"'],
      expect.objectContaining({
        shell: false,
        windowsVerbatimArguments: true,
      }),
    );
  });
});

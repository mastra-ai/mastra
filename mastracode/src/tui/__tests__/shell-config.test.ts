import { describe, expect, it } from 'vitest';

import {
  MASTRACODE_SHELL_ENV,
  MASTRACODE_SHELL_MODE_ENV,
  buildPowerShellArgs,
  buildPowerShellScript,
  inferShellFamily,
  resolveShellPassthroughInvocation,
} from '../shell-config';

function decodePowerShellArg(encodedCommand: string): string {
  return Buffer.from(encodedCommand, 'base64').toString('utf16le');
}

describe('shell passthrough config', () => {
  it('returns default shell mode when no settings or env overrides exist', () => {
    const invocation = resolveShellPassthroughInvocation('echo ok', undefined, {}, 'darwin');

    expect(invocation).toEqual({
      kind: 'default',
      mode: 'default',
      label: 'default shell',
      warnings: [],
    });
  });

  it('ignores empty env values and uses persisted settings', () => {
    const invocation = resolveShellPassthroughInvocation(
      'echo $ZSH_VERSION',
      { mode: 'path', executable: '/bin/zsh' },
      {
        [MASTRACODE_SHELL_ENV]: '   ',
        [MASTRACODE_SHELL_MODE_ENV]: '',
      },
      'darwin',
    );

    expect(invocation).toMatchObject({
      kind: 'explicit',
      mode: 'path',
      family: 'posix',
      executable: '/bin/zsh',
      args: ['-c', 'echo $ZSH_VERSION'],
      warnings: [],
    });
  });

  it('lets env shell and mode override persisted settings', () => {
    const invocation = resolveShellPassthroughInvocation(
      'echo $0',
      { mode: 'path', executable: '/bin/bash' },
      {
        [MASTRACODE_SHELL_ENV]: '/bin/zsh',
        [MASTRACODE_SHELL_MODE_ENV]: 'login',
      },
      'darwin',
    );

    expect(invocation).toMatchObject({
      kind: 'explicit',
      mode: 'login',
      family: 'posix',
      executable: '/bin/zsh',
      args: ['-l', '-c', 'echo $0'],
      warnings: [],
    });
  });

  it('uses path mode when only MASTRACODE_SHELL is set', () => {
    const invocation = resolveShellPassthroughInvocation(
      'echo ok',
      { mode: 'default' },
      { [MASTRACODE_SHELL_ENV]: '/bin/bash' },
      'linux',
    );

    expect(invocation).toMatchObject({
      kind: 'explicit',
      mode: 'path',
      family: 'posix',
      executable: '/bin/bash',
      args: ['-c', 'echo ok'],
    });
  });

  it('uses path mode when persisted settings provide an executable without an explicit mode', () => {
    const invocation = resolveShellPassthroughInvocation('echo ok', { executable: '/bin/zsh' }, {}, 'darwin');

    expect(invocation).toMatchObject({
      kind: 'explicit',
      mode: 'path',
      family: 'posix',
      executable: '/bin/zsh',
      args: ['-c', 'echo ok'],
    });
  });

  it('keeps persisted login mode when MASTRACODE_SHELL overrides only the executable', () => {
    const invocation = resolveShellPassthroughInvocation(
      'echo ok',
      { mode: 'login', executable: '/bin/bash' },
      { [MASTRACODE_SHELL_ENV]: '/bin/zsh' },
      'darwin',
    );

    expect(invocation).toMatchObject({
      kind: 'explicit',
      mode: 'login',
      family: 'posix',
      executable: '/bin/zsh',
      args: ['-l', '-c', 'echo ok'],
    });
  });

  it('infers family from MASTRACODE_SHELL instead of reusing persisted family', () => {
    const invocation = resolveShellPassthroughInvocation(
      'echo ok',
      { mode: 'path', executable: 'pwsh', family: 'powershell' },
      { [MASTRACODE_SHELL_ENV]: '/bin/zsh' },
      'darwin',
    );

    expect(invocation).toMatchObject({
      kind: 'explicit',
      mode: 'path',
      family: 'posix',
      executable: '/bin/zsh',
      args: ['-c', 'echo ok'],
    });
  });

  it('ignores invalid persisted mode when MASTRACODE_SHELL is present', () => {
    const invocation = resolveShellPassthroughInvocation(
      'echo ok',
      { mode: 'profile', executable: '/bin/bash' },
      { [MASTRACODE_SHELL_ENV]: '/bin/zsh' },
      'darwin',
    );

    expect(invocation).toMatchObject({
      kind: 'explicit',
      mode: 'path',
      family: 'posix',
      executable: '/bin/zsh',
      args: ['-c', 'echo ok'],
      warnings: [],
    });
  });

  it('falls back to default with a warning for invalid mode settings', () => {
    const invocation = resolveShellPassthroughInvocation(
      'echo ok',
      { mode: 'profile', executable: '/bin/zsh' },
      {},
      'darwin',
    );

    expect(invocation).toMatchObject({
      kind: 'default',
      warnings: ['shellPassthrough.mode must be default, path, or login'],
    });
  });

  it('falls back to default with a warning when explicit mode has no executable', () => {
    const invocation = resolveShellPassthroughInvocation('echo ok', { mode: 'path' }, {}, 'linux');

    expect(invocation).toMatchObject({
      kind: 'default',
      warnings: ['shell passthrough path mode requires an executable'],
    });
  });

  it('builds Windows cmd invocation args', () => {
    const invocation = resolveShellPassthroughInvocation('dir', { mode: 'path', executable: 'cmd.exe' }, {}, 'win32');

    expect(invocation).toMatchObject({
      kind: 'explicit',
      mode: 'path',
      family: 'cmd',
      executable: 'cmd.exe',
      args: ['/d', '/s', '/c', '"dir"'],
    });
  });

  it('wraps cmd commands for /s quote stripping', () => {
    const invocation = resolveShellPassthroughInvocation(
      String.raw`"C:\Program Files\Git\bin\git.exe" status`,
      { mode: 'path', executable: 'cmd.exe' },
      {},
      'win32',
    );

    expect(invocation).toMatchObject({
      kind: 'explicit',
      family: 'cmd',
      args: ['/d', '/s', '/c', String.raw`""C:\Program Files\Git\bin\git.exe" status"`],
    });
  });

  it('preserves inner quotes in cmd commands so /s strips only the outer pair', () => {
    const invocation = resolveShellPassthroughInvocation(
      'echo "hello world" & dir',
      { mode: 'path', executable: 'cmd.exe' },
      {},
      'win32',
    );

    // Under /s cmd strips the first and last quote on the line, leaving the
    // inner command (including its own quotes) intact.
    expect(invocation).toMatchObject({
      kind: 'explicit',
      family: 'cmd',
      args: ['/d', '/s', '/c', '"echo "hello world" & dir"'],
    });
  });

  it('wraps cmd commands that end with a quote', () => {
    const invocation = resolveShellPassthroughInvocation(
      'type "notes.txt"',
      { mode: 'path', executable: 'cmd.exe' },
      {},
      'win32',
    );

    // The appended wrapper quote becomes the line's last quote, so /s strips it
    // and the leading wrapper quote, preserving the command's own trailing quote.
    expect(invocation).toMatchObject({
      kind: 'explicit',
      family: 'cmd',
      args: ['/d', '/s', '/c', '"type "notes.txt""'],
    });
  });

  it('does not label cmd login mode as loading profiles', () => {
    const invocation = resolveShellPassthroughInvocation('dir', { mode: 'login', executable: 'cmd.exe' }, {}, 'win32');

    expect(invocation).toMatchObject({
      kind: 'explicit',
      mode: 'login',
      family: 'cmd',
      label: 'cmd (cmd)',
    });
  });

  it('requires a family for unrecognized Windows shell executables', () => {
    const invocation = resolveShellPassthroughInvocation(
      'echo ok',
      { mode: 'path', executable: 'nu.exe' },
      {},
      'win32',
    );

    expect(invocation).toMatchObject({
      kind: 'default',
      warnings: ['could not infer shell family for nu.exe'],
    });
  });

  it('supports explicit POSIX family on Windows-like paths', () => {
    const invocation = resolveShellPassthroughInvocation(
      'echo ok',
      { mode: 'path', executable: String.raw`C:\msys64\usr\bin\bash.exe`, family: 'posix' },
      {},
      'win32',
    );

    expect(invocation).toMatchObject({
      kind: 'explicit',
      mode: 'path',
      family: 'posix',
      args: ['-c', 'echo ok'],
    });
  });

  it('infers PowerShell family from common executable basenames', () => {
    expect(inferShellFamily('pwsh', 'win32')).toBe('powershell');
    expect(inferShellFamily(String.raw`C:\Program Files\PowerShell\7\pwsh.exe`, 'win32')).toBe('powershell');
    expect(inferShellFamily('/usr/local/bin/powershell', 'linux')).toBe('powershell');
  });

  it('builds PowerShell path mode with encoded command and NoProfile', () => {
    const invocation = resolveShellPassthroughInvocation(
      'Get-ChildItem',
      { mode: 'path', executable: 'pwsh' },
      {},
      'win32',
    );

    expect(invocation.kind).toBe('explicit');
    if (invocation.kind !== 'explicit') return;

    expect(invocation.family).toBe('powershell');
    expect(invocation.args.slice(0, 4)).toEqual(['-NoLogo', '-NonInteractive', '-NoProfile', '-EncodedCommand']);
    expect(decodePowerShellArg(invocation.args[4]!)).toContain("[scriptblock]::Create('Get-ChildItem')");
  });

  it('builds PowerShell login mode without NoProfile', () => {
    const args = buildPowerShellArgs('Get-Location', { loadProfile: true });

    expect(args).toContain('-EncodedCommand');
    expect(args).not.toContain('-NoProfile');
    expect(decodePowerShellArg(args.at(-1)!)).toContain("[scriptblock]::Create('Get-Location')");
  });

  it('escapes single quotes in PowerShell commands before encoding', () => {
    const script = buildPowerShellScript("Write-Output 'ok'");

    expect(script).toContain("[scriptblock]::Create('Write-Output ''ok''')");
  });

  it('adds native exit code and cmdlet failure handling to PowerShell wrapper', () => {
    const script = buildPowerShellScript('native-tool --fails');

    expect(script).toContain('$PSNativeCommandUseErrorActionPreference = $false');
    expect(script).toContain('$nativeExitCode = $global:LASTEXITCODE');
    expect(script).toContain('if (-not $commandSucceeded) {');
    expect(script).toContain('if ($nativeExitCode -is [int] -and $nativeExitCode -ne 0) { exit $nativeExitCode }');
    expect(script).toContain('exit 1');
    expect(script).toContain('} catch {');
    expect(script).toContain('exit 1');
  });

  it('does not treat a stale PowerShell native exit code as failure after a successful final command', () => {
    const script = buildPowerShellScript('git diff --quiet; Write-Output done');

    expect(script.indexOf('if (-not $commandSucceeded) {')).toBeLessThan(
      script.indexOf('if ($nativeExitCode -is [int] -and $nativeExitCode -ne 0) { exit $nativeExitCode }'),
    );
    expect(
      script.indexOf('if ($nativeExitCode -is [int] -and $nativeExitCode -ne 0) { exit $nativeExitCode }'),
    ).toBeLessThan(script.indexOf('exit 0'));
  });
});

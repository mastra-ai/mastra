import type { ShellPassthroughSettings } from '../onboarding/settings';

export const MASTRACODE_SHELL_ENV = 'MASTRACODE_SHELL';
export const MASTRACODE_SHELL_MODE_ENV = 'MASTRACODE_SHELL_MODE';

export type ShellPassthroughMode = 'default' | 'path' | 'login';
export type ShellFamily = 'posix' | 'cmd' | 'powershell';

export interface DefaultShellInvocation {
  kind: 'default';
  mode: 'default';
  label: string;
  warnings: string[];
}

export interface ExplicitShellInvocation {
  kind: 'explicit';
  mode: Exclude<ShellPassthroughMode, 'default'>;
  family: ShellFamily;
  executable: string;
  args: string[];
  label: string;
  warnings: string[];
}

export type ShellPassthroughInvocation = DefaultShellInvocation | ExplicitShellInvocation;

const VALID_MODES = new Set<ShellPassthroughMode>(['default', 'path', 'login']);
const VALID_FAMILIES = new Set<ShellFamily>(['posix', 'cmd', 'powershell']);
const POWERSHELL_BASENAMES = new Set(['pwsh', 'pwsh.exe', 'powershell', 'powershell.exe']);
const CMD_BASENAMES = new Set(['cmd', 'cmd.exe']);

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function parseMode(value: unknown): ShellPassthroughMode | undefined {
  const mode = nonEmptyString(value);
  return mode && VALID_MODES.has(mode as ShellPassthroughMode) ? (mode as ShellPassthroughMode) : undefined;
}

function parseFamily(value: unknown): ShellFamily | undefined {
  const family = nonEmptyString(value);
  return family && VALID_FAMILIES.has(family as ShellFamily) ? (family as ShellFamily) : undefined;
}

function executableBasename(executable: string): string {
  return executable.split(/[\\/]/).pop()?.toLowerCase() ?? executable.toLowerCase();
}

export function inferShellFamily(executable: string, platform: NodeJS.Platform | string): ShellFamily | undefined {
  const basename = executableBasename(executable);
  if (POWERSHELL_BASENAMES.has(basename)) return 'powershell';
  if (CMD_BASENAMES.has(basename)) return 'cmd';
  return platform === 'win32' ? undefined : 'posix';
}

function shellDisplayName(executable: string): string {
  return executableBasename(executable).replace(/\.exe$/i, '');
}

function quotePowerShellSingleQuotedString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildPowerShellScript(command: string): string {
  return [
    "$ErrorActionPreference = 'Stop'",
    '$PSNativeCommandUseErrorActionPreference = $false',
    '$global:LASTEXITCODE = $null',
    `$scriptBlock = [scriptblock]::Create(${quotePowerShellSingleQuotedString(command)})`,
    'try {',
    '  & $scriptBlock',
    '  $commandSucceeded = $?',
    '  $nativeExitCode = $global:LASTEXITCODE',
    '  if (-not $commandSucceeded) {',
    '    if ($nativeExitCode -is [int] -and $nativeExitCode -ne 0) { exit $nativeExitCode }',
    '    exit 1',
    '  }',
    '  exit 0',
    '} catch {',
    '  [Console]::Error.WriteLine($_.ToString())',
    '  exit 1',
    '}',
  ].join('\n');
}

export function encodePowerShellCommand(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64');
}

export function buildPowerShellArgs(command: string, options: { loadProfile: boolean }): string[] {
  return [
    '-NoLogo',
    '-NonInteractive',
    ...(options.loadProfile ? [] : ['-NoProfile']),
    '-EncodedCommand',
    encodePowerShellCommand(buildPowerShellScript(command)),
  ];
}

function buildExplicitShellArgs(
  family: ShellFamily,
  mode: Exclude<ShellPassthroughMode, 'default'>,
  command: string,
): string[] {
  if (family === 'powershell') {
    return buildPowerShellArgs(command, { loadProfile: mode === 'login' });
  }

  if (family === 'cmd') {
    // With /s, cmd.exe strips the first and last quote on the line and runs
    // everything in between verbatim. Wrapping the whole command in one pair of
    // quotes therefore preserves any inner quotes (e.g. quoted paths) exactly,
    // without needing to escape them. See the cmd /C quote-handling rules.
    return ['/d', '/s', '/c', `"${command}"`];
  }

  return mode === 'login' ? ['-l', '-c', command] : ['-c', command];
}

function defaultInvocation(warnings: string[] = []): DefaultShellInvocation {
  return {
    kind: 'default',
    mode: 'default',
    label: 'default shell',
    warnings,
  };
}

export function resolveShellPassthroughInvocation(
  command: string,
  settings: ShellPassthroughSettings | undefined,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform | string = process.platform,
): ShellPassthroughInvocation {
  const warnings: string[] = [];
  const envExecutable = nonEmptyString(env[MASTRACODE_SHELL_ENV]);
  const settingsExecutable = nonEmptyString(settings?.executable);
  const envModeValue = nonEmptyString(env[MASTRACODE_SHELL_MODE_ENV]);
  const settingsModeValue = nonEmptyString(settings?.mode);
  const settingsFamilyValue = nonEmptyString(settings?.family);
  const hasEnvExecutable = Boolean(envExecutable);

  let mode = parseMode(envModeValue);
  if (envModeValue && !mode) {
    warnings.push(`${MASTRACODE_SHELL_MODE_ENV} must be default, path, or login`);
    return defaultInvocation(warnings);
  }

  if (!mode) {
    const settingsMode = parseMode(settingsModeValue);
    if (settingsModeValue && !settingsMode && !hasEnvExecutable) {
      warnings.push('shellPassthrough.mode must be default, path, or login');
      return defaultInvocation(warnings);
    }
    mode = hasEnvExecutable
      ? settingsMode && settingsMode !== 'default'
        ? settingsMode
        : 'path'
      : (settingsMode ?? (settingsExecutable ? 'path' : undefined));
  }

  const executable = envExecutable ?? settingsExecutable;
  mode ??= 'default';

  if (mode === 'default') {
    return defaultInvocation(warnings);
  }

  if (!executable) {
    warnings.push(`shell passthrough ${mode} mode requires an executable`);
    return defaultInvocation(warnings);
  }

  let family = hasEnvExecutable ? undefined : parseFamily(settingsFamilyValue);
  if (settingsFamilyValue && !family && !hasEnvExecutable) {
    warnings.push('shellPassthrough.family must be posix, cmd, or powershell');
    return defaultInvocation(warnings);
  }

  family ??= inferShellFamily(executable, platform);
  if (!family) {
    warnings.push(`could not infer shell family for ${executable}`);
    return defaultInvocation(warnings);
  }

  const normalizedMode: Exclude<ShellPassthroughMode, 'default'> = mode === 'login' ? 'login' : 'path';
  const args = buildExplicitShellArgs(family, normalizedMode, command);
  const profileLabel =
    family === 'powershell' && normalizedMode === 'path'
      ? ', no profile'
      : normalizedMode === 'login' && family !== 'cmd'
        ? ', login/profile'
        : '';

  return {
    kind: 'explicit',
    mode: normalizedMode,
    family,
    executable,
    args,
    label: `${shellDisplayName(executable)} (${family}${profileLabel})`,
    warnings,
  };
}

export function describeShellPassthroughInvocation(invocation: ShellPassthroughInvocation): string {
  return invocation.label;
}

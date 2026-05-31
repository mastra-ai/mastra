import type { ShellPassthroughSettings } from '../onboarding/settings.js';
import { resolveShellPassthroughInvocation } from './shell-config.js';

const SHELL_COMMAND_TIMEOUT_MS = 30_000;

export async function createShellPassthroughSubprocess(
  command: string,
  settings: ShellPassthroughSettings,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform | string = process.platform,
  cwd: string = process.cwd(),
) {
  const { execa } = await import('execa');
  const invocation = resolveShellPassthroughInvocation(command, settings, env, platform);
  const options = {
    cwd,
    reject: false,
    timeout: SHELL_COMMAND_TIMEOUT_MS,
    env: {
      ...env,
      FORCE_COLOR: '1',
    },
  };

  if (invocation.kind === 'default') {
    return {
      invocation,
      subprocess: execa(command, {
        ...options,
        shell: true,
      }),
    };
  }

  return {
    invocation,
    subprocess: execa(invocation.executable, invocation.args, {
      ...options,
      shell: false,
      ...(invocation.family === 'cmd' && platform === 'win32' ? { windowsVerbatimArguments: true } : {}),
    }),
  };
}

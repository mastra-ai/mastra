const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function buildProcessInvocation(
  command: string,
  options: { cwd?: string; env?: NodeJS.ProcessEnv },
): { cmd: string; args: string[] } {
  const setup: string[] = [];

  for (const [name, value] of Object.entries(options.env ?? {})) {
    if (!ENV_NAME.test(name)) {
      throw new Error(`Invalid environment variable name: ${name}`);
    }
    if (value === undefined) continue;
    setup.push(`export ${name}=${shellQuote(value)}`);
  }

  if (options.cwd) {
    setup.push(`cd -- ${shellQuote(options.cwd)}`);
  }

  setup.push('exec bash -lc "$1"');
  return { cmd: 'bash', args: ['-lc', setup.join('\n'), 'mastra', command] };
}

import { Option } from 'commander';
import type { Command } from 'commander';
import pc from 'picocolors';
import { collect } from '../api/index.js';
import { environmentId, options, platformCommand, print, projectClient, table } from '../platform/shared.js';
import { wrapAction } from '../utils.js';

export function registerSandboxesCommand(program: Command) {
  const sandboxes = platformCommand(program, 'sandboxes', 'Start and use sandboxes on Mastra Platform');

  sandboxes
    .command('list')
    .description('List sandboxes in an environment')
    .option('--env <environment>', 'Environment (defaults to production)')
    .option('--all', 'Include destroyed sandboxes')
    .action(
      wrapAction(async (_opts, command: Command) => {
        const opts = options<{ env?: string; all?: boolean }>(command);
        const platform = await projectClient(opts);
        const all = await platform.sandboxes.list(await environmentId(platform, opts.env));
        const list = opts.all ? all : all.filter(sandbox => sandbox.status !== 'destroyed');
        print(opts, list, () => table(list, ['id', 'status', 'provider', 'createdAt']));
      }),
    );

  sandboxes
    .command('create')
    .description('Start a sandbox')
    .option('--env <environment>', 'Environment (defaults to production)')
    .option('--idle-timeout <minutes>', 'Minutes of inactivity before the sandbox stops', Number)
    .option('--public-ports', 'Let anyone with a port URL reach it without signing in')
    .addOption(
      new Option('--network-isolation <mode>', 'Network isolation for the sandbox').choices(['ISOLATED', 'PRIVATE']),
    )
    .action(
      wrapAction(async (_opts, command: Command) => {
        const opts = options<{
          env?: string;
          idleTimeout?: number;
          publicPorts?: boolean;
          networkIsolation?: 'ISOLATED' | 'PRIVATE';
        }>(command);
        const platform = await projectClient(opts);
        const sandbox = await platform.createSandbox({
          environmentId: await environmentId(platform, opts.env),
          ...(opts.idleTimeout ? { idleTimeoutMinutes: opts.idleTimeout } : {}),
          ...(opts.publicPorts ? { publicPorts: true } : {}),
          ...(opts.networkIsolation ? { networkIsolation: opts.networkIsolation } : {}),
        });
        print(opts, { id: sandbox.sandboxId, status: sandbox.status }, () =>
          [
            `${pc.green('Started sandbox')} ${sandbox.sandboxId}`,
            '',
            `  Run a command in it: mastra sandboxes exec ${sandbox.sandboxId} -- ls -la`,
          ].join('\n'),
        );
      }),
    );

  sandboxes
    .command('exec <sandboxId> <command...>')
    .description('Run a command in a sandbox and print its output. Put the command after --')
    .option('--cwd <path>', 'Directory to run the command in')
    .option('--var <KEY=VALUE>', 'Environment variable for the command (repeatable)', collect, [])
    .option('--timeout <seconds>', 'Stop waiting for the command after this many seconds (0 for no limit)', Number)
    .action(
      wrapAction(async (sandboxId: string, argv: string[], _opts, command: Command) => {
        const opts = options<{ cwd?: string; var: string[]; timeout?: number }>(command);
        const env = Object.fromEntries(
          opts.var.map(pair => {
            const at = pair.indexOf('=');
            if (at < 1) throw new Error(`--var expects KEY=VALUE, got "${pair}"`);
            return [pair.slice(0, at), pair.slice(at + 1)];
          }),
        );
        const sandbox = await (await projectClient(opts)).getSandbox(sandboxId);
        const [executable, ...args] = argv;
        const result = await sandbox.executeCommand!(executable!, args, {
          ...(opts.cwd ? { cwd: opts.cwd } : {}),
          ...(opts.var.length ? { env } : {}),
          ...(opts.timeout !== undefined ? { timeout: opts.timeout * 1000 } : {}),
        });
        if (opts.json) {
          print(opts, { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr }, () => '');
        } else {
          process.stdout.write(result.stdout);
          process.stderr.write(result.stderr);
        }
        // Writes to a pipe are asynchronous on macOS; let them drain before exiting with the command's code.
        await Promise.all([process.stdout, process.stderr].map(s => new Promise(resolve => s.write('', resolve))));
        process.exit(result.exitCode ?? 1);
      }),
    );

  sandboxes
    .command('destroy <sandboxId>')
    .description('Stop a sandbox and release it')
    .action(
      wrapAction(async (sandboxId: string, _opts, command: Command) => {
        const opts = options(command);
        const sandbox = await (await projectClient(opts)).getSandbox(sandboxId);
        await sandbox.destroy();
        print(opts, { id: sandboxId, destroyed: true }, () => `${pc.green('Destroyed sandbox')} ${sandboxId}`);
      }),
    );

  return sandboxes;
}

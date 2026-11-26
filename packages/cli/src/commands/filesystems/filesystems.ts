import type { Command } from 'commander';
import pc from 'picocolors';
import { environmentId, options, platformCommand, print, projectClient, provision, table } from '../platform/shared.js';
import { wrapAction } from '../utils.js';

export function registerFilesystemsCommand(program: Command) {
  const filesystems = platformCommand(program, 'filesystems', 'Provision file systems on Mastra Platform');

  filesystems
    .command('list')
    .description('List file systems in an environment')
    .option('--env <environment>', 'Environment (defaults to production)')
    .action(
      wrapAction(async (_opts, command: Command) => {
        const opts = options<{ env?: string }>(command);
        const platform = await projectClient(opts);
        const list = await platform.filesystems.list(await environmentId(platform, opts.env));
        print(opts, list, () => table(list, ['id', 'name', 'status', 'bucketName']));
      }),
    );

  filesystems
    .command('create <name>')
    .description('Provision a file system')
    .option('--env <environment>', 'Environment (defaults to production)')
    .option('--no-wait', 'Return without waiting for it to be ready')
    .action(
      wrapAction(async (name: string, _opts, command: Command) => {
        const opts = options<{ env?: string }>(command);
        const platform = await projectClient(opts);
        const environment = await environmentId(platform, opts.env);
        const filesystem = await provision(
          opts,
          'file system',
          () => platform.filesystems.create({ environmentId: environment, name }),
          id => platform.filesystems.waitUntilReady(id),
        );
        print(
          opts,
          filesystem,
          () => `${pc.green('File system')} ${filesystem.name ?? name} (${filesystem.id}) is ${filesystem.status}`,
        );
      }),
    );

  filesystems
    .command('delete <filesystemId>')
    .description('Delete a file system')
    .action(
      wrapAction(async (filesystemId: string, _opts, command: Command) => {
        const opts = options(command);
        const platform = await projectClient(opts);
        const filesystem = await platform.filesystems.get(filesystemId);
        await platform.filesystems.delete(filesystem);
        print(opts, { id: filesystemId, deleted: true }, () => `${pc.green('Deleted file system')} ${filesystemId}`);
      }),
    );

  return filesystems;
}

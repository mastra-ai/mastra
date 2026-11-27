import type { Command } from 'commander';
import pc from 'picocolors';
import { environmentId, options, platformCommand, print, projectClient, provision, table } from '../platform/shared.js';
import { wrapAction } from '../utils.js';

export function registerMemoryCommand(program: Command) {
  const memory = platformCommand(program, 'memory', 'Provision hosted Memory instances on Mastra Platform');

  memory
    .command('list')
    .description('List Memory instances')
    .action(
      wrapAction(async (_opts, command: Command) => {
        const opts = options(command);
        const list = await (await projectClient(opts)).memoryInstances.list();
        print(opts, list, () => table(list, ['id', 'name', 'status', 'region']));
      }),
    );

  memory
    .command('create <name>')
    .description('Provision a Memory instance')
    .option('--env <environment>', 'Environment to scope the instance to')
    .option('--no-wait', 'Return without waiting for it to be ready')
    .action(
      wrapAction(async (name: string, _opts, command: Command) => {
        const opts = options<{ env?: string }>(command);
        const platform = await projectClient(opts);
        const environment = opts.env ? await environmentId(platform, opts.env) : undefined;
        const instance = await provision(
          opts,
          'Memory instance',
          () => platform.memoryInstances.create({ name, ...(environment ? { environmentId: environment } : {}) }),
          id => platform.memoryInstances.waitUntilReady(id),
        );
        print(opts, instance, () =>
          [
            `${pc.green('Memory instance')} ${instance.name} (${instance.id}) is ${instance.status}`,
            '',
            `  Use it: MASTRA_MEMORY_INSTANCE_ID=${instance.id}`,
          ].join('\n'),
        );
      }),
    );

  memory
    .command('delete <instanceId>')
    .description('Delete a Memory instance')
    .action(
      wrapAction(async (instanceId: string, _opts, command: Command) => {
        const opts = options(command);
        await (await projectClient(opts)).memoryInstances.delete(instanceId);
        print(opts, { id: instanceId, deleted: true }, () => `${pc.green('Deleted Memory instance')} ${instanceId}`);
      }),
    );

  return memory;
}

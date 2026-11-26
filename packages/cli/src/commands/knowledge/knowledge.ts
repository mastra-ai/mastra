import type { Command } from 'commander';
import pc from 'picocolors';
import { options, platformCommand, print, projectClient, provision, table } from '../platform/shared.js';
import { wrapAction } from '../utils.js';

export function registerKnowledgeCommand(program: Command) {
  const knowledge = platformCommand(program, 'knowledge', 'Provision hosted Knowledge instances on Mastra Platform');

  knowledge
    .command('list')
    .description('List Knowledge instances')
    .action(
      wrapAction(async (_opts, command: Command) => {
        const opts = options(command);
        const list = await (await projectClient(opts)).knowledgeInstances.list();
        print(opts, list, () => table(list, ['id', 'status', 'region']));
      }),
    );

  knowledge
    .command('create')
    .description('Provision a Knowledge instance')
    .option('--no-wait', 'Return without waiting for it to be ready')
    .action(
      wrapAction(async (_opts, command: Command) => {
        const opts = options(command);
        const platform = await projectClient(opts);
        const instance = await provision(
          opts,
          'Knowledge instance',
          () => platform.knowledgeInstances.create(),
          id => platform.knowledgeInstances.waitUntilReady(id),
        );
        print(opts, instance, () =>
          [
            `${pc.green('Knowledge instance')} ${instance.id} is ${instance.status}`,
            '',
            `  Use it: MASTRA_KNOWLEDGE_INSTANCE_ID=${instance.id}`,
          ].join('\n'),
        );
      }),
    );

  knowledge
    .command('delete <instanceId>')
    .description('Delete a Knowledge instance')
    .action(
      wrapAction(async (instanceId: string, _opts, command: Command) => {
        const opts = options(command);
        await (await projectClient(opts)).knowledgeInstances.delete(instanceId);
        print(opts, { id: instanceId, deleted: true }, () => `${pc.green('Deleted Knowledge instance')} ${instanceId}`);
      }),
    );

  return knowledge;
}

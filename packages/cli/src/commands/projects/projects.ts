import type { Command } from 'commander';
import pc from 'picocolors';
import { options, organizationClient, platformCommand, print, table } from '../platform/shared.js';
import { wrapAction } from '../utils.js';

export function registerProjectsCommand(program: Command) {
  const projects = platformCommand(program, 'projects', "Manage the organization's projects on Mastra Platform", {
    project: false,
  });

  projects
    .command('list')
    .description('List projects in the organization')
    .action(
      wrapAction(async (_opts, command: Command) => {
        const opts = options(command);
        const list = await (await organizationClient(opts)).projects.list();
        print(opts, list, () => table(list, ['id', 'slug', 'name']));
      }),
    );

  projects
    .command('create <name>')
    .description('Create a project')
    .option('--region <region>', 'Region to run the project in')
    .action(
      wrapAction(async (name: string, _opts, command: Command) => {
        const opts = options<{ region?: string }>(command);
        const platform = await organizationClient(opts);
        const project = await platform.projects.create({ name, ...(opts.region ? { region: opts.region } : {}) });
        print(opts, project, () =>
          [
            `${pc.green('Created project')} ${project.name} (${project.id})`,
            '',
            `  Use it in this shell: export MASTRA_PROJECT_ID=${project.id}`,
          ].join('\n'),
        );
      }),
    );

  projects
    .command('delete <project>')
    .description('Delete a project and everything in it')
    .action(
      wrapAction(async (projectId: string, _opts, command: Command) => {
        const opts = options(command);
        await (await organizationClient(opts)).projects.delete(projectId);
        print(opts, { id: projectId, deleted: true }, () => `${pc.green('Deleted project')} ${projectId}`);
      }),
    );

  return projects;
}

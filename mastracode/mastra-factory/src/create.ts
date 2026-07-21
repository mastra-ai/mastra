import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import color from 'picocolors';
import { x } from 'tinyexec';
import type { Analytics } from './analytics';
import { cloneTemplate, renameProject } from './utils/clone';
import { getPackageManager } from './utils/pm';

export interface CreateArgs {
  projectName?: string;
  template: string;
  analytics: Analytics;
}

export async function create(args: CreateArgs): Promise<void> {
  p.intro(color.inverse(' Mastra Software Factory '));

  const projectName = args.projectName ?? (await p.text({
    message: 'What do you want to name your project?',
    placeholder: 'my-software-factory',
    validate: value => {
      if (!value?.trim()) return `Project name can't be empty`;
      if (fs.existsSync(path.resolve(value.trim()))) return `Directory ${value.trim()} already exists`;
      return undefined;
    },
  }))

  if (p.isCancel(projectName)) {
    p.cancel('Operation cancelled');
    process.exit(0);
  }

  const projectPath = path.resolve(projectName);
  const packageManager = getPackageManager();

  args.analytics.trackEvent('sf_create_started', {
    package_manager: packageManager,
  });

  const s = p.spinner();
  s.start('Downloading the Software Factory template...');
  try {
    await cloneTemplate(args.template, projectPath);
    await renameProject(projectPath, projectName);
    s.stop('Template downloaded.');
  } catch (err) {
    s.stop('Template download failed.');
    throw err;
  }

  const installSpinner = p.spinner();
  installSpinner.start(`Installing dependencies...`);
  try {
    await x(packageManager, ['install'], {
      nodeOptions: {
        cwd: projectPath,
      }
    });
    installSpinner.stop('Dependencies installed.');
  } catch (err) {
    installSpinner.stop('Dependency install failed.');
    throw new Error(
      `${err instanceof Error ? err.message : String(err)}\nYou can retry manually: cd ${projectName} && ${packageManager} install`,
    );
  }

  try {
    await x('git', ['init', '-q'], { nodeOptions: { cwd: projectPath } });
    await x('git', ['add', '-A'], { nodeOptions: { cwd: projectPath } });
    await x('git', ['commit', '-q', '-m', 'Initial commit from create-factory'], {
      nodeOptions: { cwd: projectPath },
    });
  } catch {
    p.log.warn('git init failed — you can initialize the repository yourself later.');
  }

  args.analytics.trackEvent('sf_create_completed', {
    package_manager: packageManager,
  });

  const lines = [
    color.green('Your Software Factory is ready!'),
    '',
    `${color.cyan('cd')} ${projectName}`,
    color.cyan(`${packageManager} run dev`),
    '',
    `Factory UI     ${color.underline('http://localhost:5173')}`,
    `Mastra Studio  ${color.underline('http://localhost:4111')}`,
    '',
    'Open the Factory UI to finish setup (models, integrations, database).',
  ];
  p.note(lines.join('\n'), 'Next steps');
}

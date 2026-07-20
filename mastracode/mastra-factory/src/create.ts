import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import color from 'picocolors';

import type { Analytics } from './analytics.js';
import { cloneTemplate, renameProject, DEFAULT_TEMPLATE_REPO } from './utils/clone.js';
import { runInherit } from './utils/exec.js';
import { detectPackageManager } from './utils/pm.js';

export interface CreateArgs {
  projectName?: string;
  useDefaults?: boolean;
  templateRef?: string;
  templateDir?: string;
  timeout?: number;
  analytics: Analytics;
}

export async function create(args: CreateArgs): Promise<void> {
  p.intro(color.inverse(' Mastra Software Factory '));

  // ── Project name ─────────────────────────────────────────────────────────
  let projectName = args.projectName;
  if (!projectName && args.useDefaults) {
    projectName = 'my-software-factory';
  }
  if (!projectName) {
    const entered = await p.text({
      message: 'What is your project named?',
      initialValue: 'my-software-factory',
      validate: value => {
        if (!value?.trim()) return 'Required';
        if (fs.existsSync(path.resolve(value.trim()))) return `Directory ${value.trim()} already exists`;
        return undefined;
      },
    });
    if (p.isCancel(entered)) return cancel();
    projectName = entered.trim();
  }

  const projectPath = path.resolve(projectName);
  const packageManager = detectPackageManager();

  args.analytics.trackEvent('sf_create_started', {
    package_manager: packageManager,
    non_interactive: Boolean(args.useDefaults),
  });

  // ── Clone template ───────────────────────────────────────────────────────
  const spinner = p.spinner();
  spinner.start('Downloading the Software Factory template...');
  try {
    await cloneTemplate({
      repoUrl: DEFAULT_TEMPLATE_REPO,
      projectPath,
      ref: args.templateRef,
      localDir: args.templateDir,
    });
    renameProject(projectPath, projectName);
    // Seed .env from the example. Nothing is filled in here — configuration
    // (model providers, integrations, database) happens in the web UI.
    fs.copyFileSync(path.join(projectPath, '.env.example'), path.join(projectPath, '.env'));
    spinner.stop('Template downloaded.');
  } catch (err) {
    spinner.stop('Template download failed.');
    throw err;
  }

  // ── Install dependencies ─────────────────────────────────────────────────
  const installSpinner = p.spinner();
  installSpinner.start(`Installing dependencies with ${packageManager} (this can take a few minutes)...`);
  try {
    await runInherit(packageManager, ['install'], {
      cwd: projectPath,
      timeoutMs: args.timeout,
    });
    installSpinner.stop('Dependencies installed.');
  } catch (err) {
    installSpinner.stop('Dependency install failed.');
    throw new Error(
      `${err instanceof Error ? err.message : String(err)}\nYou can retry manually: cd ${projectName} && ${packageManager} install`,
    );
  }

  // ── Git init ─────────────────────────────────────────────────────────────
  try {
    await runInherit('git', ['init', '-q'], { cwd: projectPath });
    await runInherit('git', ['add', '-A'], { cwd: projectPath });
    await runInherit('git', ['commit', '-q', '-m', 'Initial commit from create-factory'], {
      cwd: projectPath,
    });
  } catch {
    p.log.warn('git init failed — you can initialize the repository yourself later.');
  }

  args.analytics.trackEvent('sf_create_completed', {
    package_manager: packageManager,
    non_interactive: Boolean(args.useDefaults),
  });

  // ── Outro ────────────────────────────────────────────────────────────────
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
  p.outro(`Problems or feedback? ${color.underline('https://github.com/mastra-ai/mastra/issues')}`);
}

function cancel(): void {
  p.cancel('Cancelled.');
  process.exitCode = 1;
}

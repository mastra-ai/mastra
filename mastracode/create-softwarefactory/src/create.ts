import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import color from 'picocolors';

import type { Analytics } from './analytics.js';
import { DEFAULT_PUBLIC_URL  } from './context.js';
import type {CreateContext} from './context.js';
import { EnvWriter } from './env.js';
import { databaseStep } from './steps/database.js';
import { githubAppStep } from './steps/github-app.js';
import { linearStep } from './steps/linear.js';
import { modelStep  } from './steps/model.js';
import type {LlmProvider} from './steps/model.js';
import { workosStep } from './steps/workos.js';
import { cloneTemplate, renameProject, DEFAULT_TEMPLATE_REPO } from './utils/clone.js';
import { runInherit } from './utils/exec.js';
import { detectPackageManager } from './utils/pm.js';

export interface CreateArgs {
  projectName?: string;
  llm?: LlmProvider;
  llmApiKey?: string;
  dbUrl?: string;
  useDefaults?: boolean;
  templateRef?: string;
  templateDir?: string;
  timeout?: number;
  analytics: Analytics;
}

export async function create(args: CreateArgs): Promise<void> {
  p.intro(color.inverse(' Mastra Software Factory '));

  // ── Project name + clone ─────────────────────────────────────────────────
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
    fs.copyFileSync(path.join(projectPath, '.env.example'), path.join(projectPath, '.env'));
    spinner.stop('Template downloaded.');
  } catch (err) {
    spinner.stop('Template download failed.');
    throw err;
  }

  const ctx: CreateContext = {
    projectName,
    projectPath,
    env: new EnvWriter(path.join(projectPath, '.env')),
    analytics: args.analytics,
    packageManager: detectPackageManager(),
    publicUrl: DEFAULT_PUBLIC_URL,
    databaseConfigured: false,
    dockerDatabase: false,
    workosConfigured: false,
    githubConfigured: false,
    linearConfigured: false,
    followUps: [],
  };

  ctx.analytics.trackEvent('sf_create_started', {
    package_manager: ctx.packageManager,
    non_interactive: Boolean(args.useDefaults),
  });

  // The browser-facing origin is the single source of truth for all OAuth
  // callback URLs (WorkOS, GitHub, Linear). Pin it to the dev SPA origin so
  // the callback URLs users register on their apps match at runtime.
  ctx.env.set('MASTRACODE_PUBLIC_URL', ctx.publicUrl);

  // ── Steps (fastest path to something working first) ──────────────────────
  await modelStep(ctx, { provider: args.llm, apiKey: args.llmApiKey, nonInteractive: args.useDefaults });
  await databaseStep(ctx, { dbUrl: args.dbUrl, useDefaults: args.useDefaults });

  if (args.useDefaults) {
    ctx.followUps.push('Enable sign-in + integrations later — see the README');
  } else {
    await workosStep(ctx);

    if (ctx.databaseConfigured && ctx.workosConfigured) {
      await githubAppStep(ctx);
      await linearStep(ctx);
    } else if (!ctx.workosConfigured) {
      p.log.info('Skipping GitHub/Linear — they need sign-in (WorkOS) and a database.');
      ctx.followUps.push('GitHub/Linear integrations need WorkOS + APP_DATABASE_URL — see the README');
    } else {
      p.log.info('Skipping GitHub/Linear — they need a database (APP_DATABASE_URL).');
      ctx.followUps.push('GitHub/Linear integrations need APP_DATABASE_URL — see the README');
    }
  }

  ctx.env.save();

  // ── Install dependencies ─────────────────────────────────────────────────
  const installSpinner = p.spinner();
  installSpinner.start(`Installing dependencies with ${ctx.packageManager} (this can take a few minutes)...`);
  try {
    await runInherit(ctx.packageManager, ['install'], {
      cwd: projectPath,
      timeoutMs: args.timeout,
    });
    installSpinner.stop('Dependencies installed.');
  } catch (err) {
    installSpinner.stop('Dependency install failed.');
    p.log.warn(
      `${err instanceof Error ? err.message : String(err)}\nYou can retry manually: cd ${projectName} && ${ctx.packageManager} install`,
    );
  }

  // ── Git init ─────────────────────────────────────────────────────────────
  let initGit: boolean | symbol = true;
  if (!args.useDefaults) {
    initGit = await p.confirm({ message: 'Initialize a git repository?', initialValue: true });
  }
  if (!p.isCancel(initGit) && initGit) {
    try {
      await runInherit('git', ['init', '-q'], { cwd: projectPath });
      await runInherit('git', ['add', '-A'], { cwd: projectPath });
      await runInherit('git', ['commit', '-q', '-m', 'Initial commit from create-softwarefactory'], {
        cwd: projectPath,
      });
    } catch {
      p.log.warn('git init failed — you can initialize the repository yourself later.');
    }
  }

  ctx.analytics.trackEvent('sf_create_completed', {
    database: ctx.databaseConfigured,
    workos: ctx.workosConfigured,
    github: ctx.githubConfigured,
    linear: ctx.linearConfigured,
  });

  // ── Outro ────────────────────────────────────────────────────────────────
  const run = (cmd: string) => color.cyan(`${ctx.packageManager} run ${cmd}`);
  const steps = [
    `${color.cyan('cd')} ${projectName}`,
    ...(ctx.dockerDatabase ? [`${run('db:up')}   ${color.dim('# start Postgres + Redis (Docker)')}`] : []),
    run('dev'),
  ];
  const lines = [
    color.green('Your Software Factory is ready!'),
    '',
    ...steps,
    '',
    `Factory UI     ${color.underline('http://localhost:5173')}`,
    `Mastra Studio  ${color.underline('http://localhost:4111')}`,
  ];
  if (ctx.githubConfigured) {
    lines.push('', `Once running: sign in, install the GitHub App on your repos,`, `and watch issues land in Intake.`);
  }
  if (ctx.followUps.length > 0) {
    lines.push('', color.bold('Finish later:'), ...ctx.followUps.map(item => `  • ${item}`));
  }
  p.note(lines.join('\n'), 'Next steps');
  p.outro(`Problems or feedback? ${color.underline('https://github.com/mastra-ai/mastra/issues')}`);
}

function cancel(): void {
  p.cancel('Project creation cancelled.');
  process.exitCode = 1;
}

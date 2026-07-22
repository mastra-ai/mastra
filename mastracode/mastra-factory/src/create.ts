import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
// `mastra/internal/auth` is the CLI's internal barrel — drives the browser-auth
// flow and reuses persisted credentials + org resolution rather than duplicating
// them here.
import { fetchOrgs, getToken, loadCredentials, resolveCurrentOrg } from 'mastra/internal/auth';
import color from 'picocolors';
import { x } from 'tinyexec';

import type { Analytics } from './analytics.js';
import { upsertEnvFile } from './env.js';
import type { PlatformProject } from './platform.js';
import {
  attachNeonDatabase,
  createServerProject,
  getDatabaseConnection,
  mintOrgApiKey,
  PlatformApiError,
  waitForDatabaseReady,
} from './platform.js';
import { cloneTemplate, renameProject } from './utils/clone.js';
import { detectPackageManager, getInstallArgs } from './utils/pm.js';

export interface CreateArgs {
  projectName?: string;
  template: string;
  /**
   * Skip the platform round-trip (auth, project, sk_ key, Neon). Useful for
   * offline scaffold testing. `.env` is left as-is from the template's
   * `.env.example`.
   */
  noPlatform?: boolean;
  /** Optional Neon region id (passed to the attach endpoint verbatim). */
  region?: string;
  /**
   * Optional org identifier (id or name) to skip the interactive org picker.
   * Behaves like `MASTRA_ORG_ID` — matches the first org whose id or name
   * equals the value. If no match, provisioning fails with a clear message.
   */
  org?: string;
  analytics: Analytics;
}

interface PlatformProvisionResult {
  orgId: string;
  orgName: string;
  project: PlatformProject;
  secretKey: string;
  databaseUrl: string;
}

export async function create(args: CreateArgs): Promise<void> {
  p.intro(color.inverse(' Mastra Factory '));

  const projectName =
    args.projectName ??
    (await p.text({
      message: 'What do you want to name your project?',
      placeholder: 'my-mastra-factory',
      validate: value => {
        if (!value?.trim()) return `Project name can't be empty`;
        if (fs.existsSync(path.resolve(value.trim()))) return `Directory ${value.trim()} already exists`;
        return undefined;
      },
    }));

  if (p.isCancel(projectName)) {
    p.cancel('Operation cancelled');
    process.exit(0);
  }

  const projectPath = path.resolve(projectName);
  const packageManager = detectPackageManager();

  args.analytics.trackEvent('sf_create_started', {
    package_manager: packageManager,
    no_platform: Boolean(args.noPlatform),
  });

  // ── Clone template ───────────────────────────────────────────────────────
  const spinner = p.spinner();
  spinner.start('Downloading the Mastra Factory template...');
  try {
    await cloneTemplate(args.template, projectPath);
    await renameProject(projectPath, projectName);
    // Seed .env from the example. Platform-provisioning below rewrites the
    // handful of platform keys idempotently; other keys stay as-is so the
    // user can configure them from the web UI.
    const envPath = path.join(projectPath, '.env');
    fs.copyFileSync(path.join(projectPath, '.env.example'), envPath);
    // Tighten perms up-front; secrets get written into this file later.
    try {
      fs.chmodSync(envPath, 0o600);
    } catch {
      // Best-effort on Unix; no-op or unsupported on Windows.
    }
    spinner.stop('Template downloaded.');
  } catch (err) {
    spinner.stop('Template download failed.');
    throw err;
  }

  // ── Install dependencies ─────────────────────────────────────────────────
  const installSpinner = p.spinner();
  installSpinner.start(`Installing dependencies...`);
  try {
    await x(packageManager, getInstallArgs(packageManager), {
      throwOnError: true,
      nodeOptions: { cwd: projectPath },
    });
    installSpinner.stop('Dependencies installed.');
  } catch (err) {
    installSpinner.stop('Dependency install failed.');
    throw new Error(
      `${err instanceof Error ? err.message : String(err)}\nYou can retry manually: cd ${projectName} && ${packageManager} install`,
    );
  }

  // ── Platform provisioning ────────────────────────────────────────────────
  let platformResult: PlatformProvisionResult | null = null;
  let platformError: string | null = null;
  if (!args.noPlatform) {
    try {
      platformResult = await runPlatformProvisioning({
        projectName,
        projectPath,
        region: args.region,
        org: args.org,
      });
    } catch (err) {
      platformError = err instanceof Error ? err.message : String(err);
      p.log.warn(`Platform provisioning failed: ${platformError}`);
    }
  }

  // ── Git init ─────────────────────────────────────────────────────────────
  // Ensure `.env` is ignored before staging so the platform secrets we just
  // wrote (MASTRA_PLATFORM_SECRET_KEY, DATABASE_URL) never enter git history.
  // Idempotent: only appends if the pattern isn't already covered.
  //
  // If we can't write `.gitignore` (permission denied, disk full, …) we must
  // NOT run `git add -A` — that would stage `.env` and commit secrets to
  // history irreversibly. Skip the git init entirely in that case and tell
  // the user how to recover.
  let gitignoreOk = true;
  try {
    ensureEnvGitignored(projectPath);
  } catch (err) {
    gitignoreOk = false;
    const detail = err instanceof Error ? err.message : String(err);
    p.log.warn(
      `Could not update .gitignore to protect .env (${detail}). Skipping git init to avoid committing secrets. Add ".env" to .gitignore manually before running 'git init && git add -A'.`,
    );
  }
  if (gitignoreOk) {
    try {
      await x('git', ['init', '-q'], { throwOnError: true, nodeOptions: { cwd: projectPath } });
      await x('git', ['add', '-A'], { throwOnError: true, nodeOptions: { cwd: projectPath } });
      await x('git', ['commit', '-q', '-m', 'Initial commit from create-factory'], {
        throwOnError: true,
        nodeOptions: { cwd: projectPath },
      });
    } catch {
      p.log.warn('git init failed — you can initialize the repository yourself later.');
    }
  }

  args.analytics.trackEvent('sf_create_completed', {
    package_manager: packageManager,
    no_platform: Boolean(args.noPlatform),
    platform_provisioned: platformResult !== null,
  });

  // ── Outro ────────────────────────────────────────────────────────────────
  const lines: string[] = [
    color.green('Your Mastra Factory is ready!'),
    '',
    `${color.cyan('cd')} ${projectName}`,
    color.cyan(`${packageManager} run dev`),
    '',
    `Factory UI     ${color.underline('http://localhost:4111')}`,
    '',
  ];
  if (platformResult) {
    lines.push(
      `${color.green('Provisioned on Mastra platform')} in ${color.cyan(platformResult.orgName)}:`,
      `  - Project ${color.cyan(platformResult.project.name)}`,
      `  - Postgres database (credentials written to ${color.cyan('.env')})`,
      '',
      'When deployed, code agent sessions run inside Mastra platform sandboxes.',
      `Manage your project at ${color.underline('https://projects.mastra.ai')}`,
    );
  } else if (args.noPlatform) {
    lines.push(
      `${color.yellow('Skipped platform provisioning (--no-platform).')} Configure ${color.cyan('.env')} manually before running.`,
    );
  } else if (platformError) {
    lines.push(
      `${color.yellow('Platform provisioning failed:')} ${platformError}`,
      `Any credentials that were minted before the failure have been written to ${color.cyan('.env')}. Re-run \`npx create factory\` after fixing, or fill in the rest manually from ${color.underline('https://platform.mastra.ai')}.`,
    );
  } else {
    lines.push('Open the Factory UI to finish setup (models, integrations, database).');
  }
  p.note(lines.join('\n'), 'Next steps');
}

async function runPlatformProvisioning({
  projectName,
  projectPath,
  region,
  org,
}: {
  projectName: string;
  projectPath: string;
  region?: string;
  org?: string;
}): Promise<PlatformProvisionResult> {
  // Accumulator: whatever we successfully mint gets flushed to .env in a
  // `finally` block below. That way a mid-flow failure (e.g. Neon still
  // provisioning) doesn't strand the freshly-issued `sk_` key, which the
  // platform never returns again.
  const envAccumulator: Record<string, string> = {};
  const envPath = path.join(projectPath, '.env');
  let flushed = false;
  const flush = () => {
    if (flushed || Object.keys(envAccumulator).length === 0) return;
    upsertEnvFile(envPath, envAccumulator);
    flushed = true;
  };

  try {
    // 1. Auth — triggers the browser-auth flow if no cached credential.
    //    When that flow is about to open (no env token, no cached credential),
    //    pause first so the browser doesn't pop open unannounced.
    const willOpenAuthFlow = !process.env.MASTRA_API_TOKEN && !(await loadCredentials());
    if (willOpenAuthFlow) {
      const proceed = await p.text({
        message: 'Mastra account is required, press enter to continue...',
        defaultValue: '',
      });
      if (p.isCancel(proceed)) {
        throw new Error('Sign-in cancelled.');
      }
    }
    p.log.info('Signing in to Mastra…');
    const token = await getToken();

    // 2. Org — `--org <id-or-name>` skips the picker; otherwise prompt every
    //    time so the user consciously chooses which org owns the new factory
    //    (matches observability-provision behavior).
    const { orgId, orgName } = org
      ? await resolveOrgFromFlag(token, org)
      : await resolveCurrentOrg(token, { forcePrompt: true });
    p.log.info(`Using organization ${color.cyan(orgName)}.`);
    envAccumulator.MASTRA_ORGANIZATION_ID = orgId;

    // 3. Project — session-auth POST /v1/server/projects.
    const projectSpinner = p.spinner();
    projectSpinner.start(`Creating platform project "${projectName}"…`);
    let project: PlatformProject;
    try {
      project = await createServerProject({ token, orgId, name: projectName });
      projectSpinner.stop(`Created platform project ${color.cyan(project.slug)}.`);
    } catch (err) {
      projectSpinner.stop('Project creation failed.');
      throw err;
    }
    envAccumulator.MASTRA_PROJECT_ID = project.id;

    // 4. Mint sk_ WorkOS org API key — becomes MASTRA_PLATFORM_SECRET_KEY.
    //    The platform shows this secret exactly once, so we record it into
    //    the env accumulator immediately after minting.
    const keySpinner = p.spinner();
    keySpinner.start('Creating platform API key…');
    let secretKey: string;
    try {
      secretKey = await mintOrgApiKey({
        token,
        orgId,
        keyName: `create-factory: ${projectName}`,
      });
      keySpinner.stop('Platform API key created.');
    } catch (err) {
      keySpinner.stop('API key creation failed.');
      throw err;
    }
    envAccumulator.MASTRA_PLATFORM_SECRET_KEY = secretKey;

    // 5-7. Neon attach + poll + connection string.
    const neonSpinner = p.spinner();
    neonSpinner.start('Provisioning Neon Postgres database…');
    let databaseUrl: string;
    try {
      const attached = await attachNeonDatabase({
        token,
        orgId,
        projectId: project.id,
        name: sanitizeDatabaseName(projectName),
        regionId: region,
      });
      const ready = await waitForDatabaseReady({
        token,
        orgId,
        projectId: project.id,
        databaseId: attached.id,
      });
      const connection = await getDatabaseConnection({
        token,
        orgId,
        projectId: project.id,
        databaseId: ready.id,
      });
      // `envVars` is an array of `{ name, value, secret }` — Neon rows always
      // include a single `DATABASE_URL` entry (see services/project-databases
      // renderConnectionInstructions).
      const dbEnv = connection.envVars.find(v => v.name === 'DATABASE_URL');
      if (!dbEnv?.value) {
        throw new PlatformApiError(500, 'Platform connection response missing DATABASE_URL.');
      }
      databaseUrl = dbEnv.value;
      neonSpinner.stop('Neon database ready.');
    } catch (err) {
      neonSpinner.stop('Database provisioning failed.');
      throw err;
    }
    envAccumulator.DATABASE_URL = databaseUrl;

    // 8. Write .env (idempotent — replaces existing keys, appends missing).
    flush();

    return { orgId, orgName, project, secretKey, databaseUrl };
  } finally {
    // Best-effort partial write on failure so a successful `sk_` mint or
    // project-id isn't thrown away when a later step blows up.
    flush();
  }
}

/**
 * `--org <value>` matches by org id or exact name. Not a substring match —
 * an ambiguous or non-existent value bails with a clear message instead of
 * silently picking the wrong org.
 */
async function resolveOrgFromFlag(token: string, value: string): Promise<{ orgId: string; orgName: string }> {
  const orgs = await fetchOrgs(token);
  const match = orgs.find(o => o.id === value || o.name === value);
  if (!match) {
    const available = orgs.map(o => `${o.name} (${o.id})`).join(', ') || '(none)';
    throw new Error(`No organization matched --org "${value}". Available: ${available}.`);
  }
  return { orgId: match.id, orgName: match.name };
}

/**
 * Neon display-name charset: `[a-zA-Z0-9_-]+`, up to 64 chars. Drop anything
 * outside that, and clip length.
 */
function sanitizeDatabaseName(projectName: string): string {
  const cleaned = projectName.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
  const truncated = (cleaned || 'factory').slice(0, 64);
  return truncated;
}

/**
 * Append `.env` to the scaffolded project's `.gitignore` if it isn't already
 * ignored. Runs before the initial `git add -A` so freshly-provisioned platform
 * credentials (MASTRA_PLATFORM_SECRET_KEY, DATABASE_URL) never reach the
 * initial commit.
 *
 * Throws if `.gitignore` cannot be written. Callers MUST treat this as fatal
 * for the git-init step when `.env` may already contain platform secrets —
 * silently continuing would stage secrets into the initial commit.
 */
function ensureEnvGitignored(projectPath: string): void {
  const gitignorePath = path.join(projectPath, '.gitignore');
  const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const lines = existing.split(/\r?\n/).map(line => line.trim());
  // Consider `.env` covered if any bare-.env or `.env*` glob line is present
  // (ignoring commented-out lines).
  const covered = lines.some(line => {
    if (!line || line.startsWith('#')) return false;
    return line === '.env' || line === '.env*' || line === '/.env' || line === '/.env*';
  });
  if (covered) return;
  const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(
    gitignorePath,
    `${existing}${prefix}\n# Added by create-factory to protect platform credentials\n.env\n`,
  );
}

import { execSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, stat, access, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as p from '@clack/prompts';
import { ZipArchive } from 'archiver';
import { config } from 'dotenv';

import { bucketApiHost, getAnalytics } from '../../analytics/index.js';
import type { CLI_ORIGIN } from '../../analytics/index.js';
import { runBuild } from '../../utils/run-build.js';
import { checkBuildStaleness } from '../../utils/source-hash.js';
import { fetchOrgs } from '../auth/api.js';
import { MASTRA_STUDIO_URL, MASTRA_PLATFORM_API_URL  } from '../auth/client.js';
import { getToken, getCurrentOrgId } from '../auth/credentials.js';
import { preflightBuildOutput, printPreflightIssues } from '../deploy-preflight.js';
import { getProjectConfigToSave, loadProjectConfig, saveProjectConfig } from '../studio/project-config.js';
import { fetchServerProjects, createServerProject, uploadServerDeploy, pollServerDeploy } from './platform-api.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getPackageName(projectDir: string): string | null {
  try {
    const raw = execSync('node -p "require(\'./package.json\').name"', {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return raw.startsWith('@') ? (raw.split('/')[1] ?? raw) : raw;
  } catch {
    return null;
  }
}

async function zipOutput(projectDir: string): Promise<string> {
  const outputDir = join(projectDir, '.mastra', 'output');
  const tmpDir = join(tmpdir(), 'mastra-deploy');
  await mkdir(tmpDir, { recursive: true });
  const zipPath = join(tmpDir, `server-deploy-${Date.now()}.zip`);

  return new Promise((resolvePromise, reject) => {
    const output = createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 6 } });

    output.on('close', () => resolvePromise(zipPath));
    archive.on('error', reject);

    archive.pipe(output);
    // Ship only the pre-built .mastra/output + package.json for dependency metadata
    archive.glob('**', { cwd: outputDir, ignore: ['node_modules/**'] }, { prefix: '.mastra/output' });
    archive.file(join(projectDir, 'package.json'), { name: 'package.json' });
    void archive.finalize();
  });
}

export function parseEnvFile(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    let key = trimmed.slice(0, eqIdx).trim();
    if (key.startsWith('export ')) key = key.slice(7).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) vars[key] = value;
  }
  return vars;
}

/**
 * Loads MASTRA_PROJECT_ID and MASTRA_ORG_ID from the project's .env files
 * into process.env so deploys auto-link to the project that `mastra init --observability`
 * provisioned. Uses dotenv with override: false (the default), so any
 * existing process.env value (e.g. from CI) always wins.
 */
export function loadDeployEnvFromDotenv(projectDir: string): void {
  config({
    path: [join(projectDir, '.env'), join(projectDir, '.env.local'), join(projectDir, '.env.production')],
    quiet: true,
  });
}

async function getDeployEnvFiles(projectDir: string): Promise<string[]> {
  const entries = await readdir(projectDir, { withFileTypes: true });

  return entries
    .filter(
      entry =>
        (entry.isFile() || entry.isSymbolicLink()) &&
        (entry.name === '.env' || entry.name.startsWith('.env.')) &&
        !entry.name.endsWith('.example'),
    )
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

export async function readEnvVars(
  projectDir: string,
  options: { autoAccept?: boolean; envFile?: string } = {},
): Promise<Record<string, string>> {
  // When an explicit env file is provided, trust the user — read it directly.
  if (options.envFile) {
    const filePath = join(projectDir, options.envFile);
    try {
      await access(filePath);
    } catch {
      throw new Error(`Env file not found: ${options.envFile}`);
    }
    p.log.step(`Using env file: ${options.envFile}`);
    return parseEnvFile(await readFile(filePath, 'utf-8'));
  }

  const availableDeployEnvFiles = await getDeployEnvFiles(projectDir);

  if (availableDeployEnvFiles.length === 0) {
    throw new Error('No env file found for deploy. Add a .env or .env.* file before deploying.');
  }

  let selectedEnvFile: string;

  if (availableDeployEnvFiles.length === 1) {
    selectedEnvFile = availableDeployEnvFiles[0]!;
  } else if (options.autoAccept) {
    throw new Error(
      `Multiple env files found: ${availableDeployEnvFiles.join(', ')}. Use --env-file to specify which one to deploy.`,
    );
  } else {
    const defaultFile =
      availableDeployEnvFiles.find(envFile => envFile === '.env.production') ?? availableDeployEnvFiles[0]!;

    const selected = await p.select({
      message: 'Choose env file to deploy',
      options: availableDeployEnvFiles.map(envFile => ({ value: envFile, label: envFile })),
      initialValue: defaultFile,
    });

    if (p.isCancel(selected)) {
      p.cancel('Deploy cancelled.');
      process.exit(0);
    }

    selectedEnvFile = selected as string;
  }

  p.log.step(`Using env file: ${selectedEnvFile}`);

  return parseEnvFile(await readFile(join(projectDir, selectedEnvFile), 'utf-8'));
}

/* ------------------------------------------------------------------ */
/*  Resolve org                                                       */
/* ------------------------------------------------------------------ */

async function resolveOrg(
  token: string,
  projectConfig: { organizationId?: string } | null,
  flagOrg?: string,
): Promise<{ orgId: string; orgName: string }> {
  const isHeadless = Boolean(process.env.MASTRA_API_TOKEN);
  const envOrgId = process.env.MASTRA_ORG_ID;
  if (envOrgId) {
    return { orgId: envOrgId, orgName: envOrgId };
  }

  if (flagOrg) {
    const orgs = await fetchOrgs(token);
    const match = orgs.find(o => o.id === flagOrg);
    return { orgId: flagOrg, orgName: match?.name ?? flagOrg };
  }

  if (projectConfig?.organizationId) {
    if (isHeadless) {
      return { orgId: projectConfig.organizationId, orgName: projectConfig.organizationId };
    }
    const orgs = await fetchOrgs(token);
    const match = orgs.find(o => o.id === projectConfig.organizationId);
    if (match) {
      return { orgId: match.id, orgName: match.name };
    }
  }

  const currentOrgId = await getCurrentOrgId();
  const orgs = await fetchOrgs(token);

  if (currentOrgId) {
    const match = orgs.find(o => o.id === currentOrgId);
    if (match) {
      return { orgId: match.id, orgName: match.name };
    }
  }

  if (orgs.length === 1) {
    return { orgId: orgs[0]!.id, orgName: orgs[0]!.name };
  }

  if (orgs.length === 0) {
    throw new Error(`No organizations found. Create one at ${MASTRA_STUDIO_URL}`);
  }

  const selected = await p.select({
    message: 'Select an organization',
    options: orgs.map(o => ({ value: o.id, label: `${o.name} (${o.id})` })),
  });

  if (p.isCancel(selected)) {
    p.cancel('Deploy cancelled.');
    process.exit(0);
  }

  const selectedOrg = orgs.find(o => o.id === selected)!;
  return { orgId: selectedOrg.id, orgName: selectedOrg.name };
}

/* ------------------------------------------------------------------ */
/*  Resolve project                                                   */
/* ------------------------------------------------------------------ */

async function resolveProject(
  token: string,
  orgId: string,
  projectConfig: { projectId?: string; projectName?: string; projectSlug?: string; organizationId?: string } | null,
  flagProject?: string,
  defaultName?: string | null,
  autoAccept?: boolean,
): Promise<{ projectId: string; projectName: string; projectSlug: string }> {
  const envProjectId = process.env.MASTRA_PROJECT_ID;
  if (envProjectId) {
    return { projectId: envProjectId, projectName: envProjectId, projectSlug: envProjectId };
  }

  if (flagProject) {
    const projects = await fetchServerProjects(token, orgId);
    const byId = projects.find(proj => proj.id === flagProject);
    const bySlug = projects.find(proj => proj.slug === flagProject);
    const byName = projects.filter(proj => proj.name === flagProject);
    if (!byId && !bySlug && byName.length > 1) {
      p.cancel(
        `Multiple projects are named "${flagProject}". Pass --project with the project id or slug to disambiguate.`,
      );
      process.exit(1);
    }
    const match = byId ?? bySlug ?? (byName.length === 1 ? byName[0] : undefined);
    if (match) {
      return { projectId: match.id, projectName: match.name, projectSlug: match.slug ?? match.name };
    }

    // No match — create a new project with the flag value as its name.
    if (!autoAccept) {
      const confirmed = await p.confirm({
        message: `No project named "${flagProject}" found. Create it?`,
      });
      if (p.isCancel(confirmed) || !confirmed) {
        p.cancel('Deploy cancelled.');
        process.exit(0);
      }
    }

    const created = await createServerProject(token, orgId, flagProject);
    p.log.success(`Created project "${created.name}"`);
    return { projectId: created.id, projectName: created.name, projectSlug: created.slug ?? created.name };
  }

  if (projectConfig?.projectId && projectConfig.organizationId === orgId) {
    return {
      projectId: projectConfig.projectId,
      projectName: projectConfig.projectName ?? projectConfig.projectId,
      projectSlug: projectConfig.projectSlug ?? projectConfig.projectName ?? projectConfig.projectId,
    };
  }

  const name = defaultName;
  if (!name) {
    throw new Error('Could not determine project name from package.json. Use --project to specify one.');
  }

  const existing = await fetchServerProjects(token, orgId);
  const nameMatches = existing.filter(proj => proj.name === name || proj.slug === name);

  if (existing.length > 0) {
    if (autoAccept) {
      // Non-interactive: only safe to auto-pick when exactly one project matches by name/slug.
      if (nameMatches.length === 1) {
        const m = nameMatches[0]!;
        return { projectId: m.id, projectName: m.name, projectSlug: m.slug ?? m.name };
      }
      throw new Error(
        `Found ${existing.length} existing project(s) in this organization. Pass --project <id-or-slug> to select one, or re-run without --yes to choose interactively.`,
      );
    }

    const CREATE_NEW = '__create_new__';
    const initialValue = nameMatches.length === 1 ? nameMatches[0]!.id : existing[0]!.id;
    const selected = await p.select({
      message: 'Select a project to deploy to',
      initialValue,
      options: [
        ...existing.map(proj => ({ value: proj.id, label: `${proj.name} (${proj.id})` })),
        { value: CREATE_NEW, label: `＋ Create new project "${name}"` },
      ],
    });

    if (p.isCancel(selected)) {
      p.cancel('Deploy cancelled.');
      process.exit(0);
    }

    if (selected !== CREATE_NEW) {
      const match = existing.find(proj => proj.id === selected)!;
      return { projectId: match.id, projectName: match.name, projectSlug: match.slug ?? match.name };
    }
  }

  const project = await createServerProject(token, orgId, name);
  return { projectId: project.id, projectName: project.name, projectSlug: project.slug ?? project.name };
}

/* ------------------------------------------------------------------ */
/*  Main deploy action                                                */
/* ------------------------------------------------------------------ */

type ServerDeployOptions = {
  org?: string;
  project?: string;
  yes?: boolean;
  config?: string;
  skipBuild?: boolean;
  skipPreflight?: boolean;
  debug?: boolean;
  envFile?: string;
};

export async function serverDeployAction(dir: string | undefined, opts: ServerDeployOptions) {
  const analytics = getAnalytics();
  if (!analytics) {
    return runServerDeploy(dir, opts);
  }
  await analytics.trackCommandExecution({
    command: 'mastra server deploy',
    args: {
      yes: Boolean(opts.yes),
      skipBuild: Boolean(opts.skipBuild),
      skipPreflight: Boolean(opts.skipPreflight),
      hasOrg: Boolean(opts.org),
      hasProject: Boolean(opts.project),
      hasEnvFile: Boolean(opts.envFile),
      hasConfig: Boolean(opts.config),
      debug: Boolean(opts.debug),
      headless: Boolean(process.env.MASTRA_API_TOKEN),
      targetApi: bucketApiHost(MASTRA_PLATFORM_API_URL),
    },
    execution: () => runServerDeploy(dir, opts),
    origin: process.env.MASTRA_ANALYTICS_ORIGIN as CLI_ORIGIN | undefined,
  });
}

async function runServerDeploy(dir: string | undefined, opts: ServerDeployOptions) {
  const targetDir = resolve(dir || process.cwd());
  // Seed MASTRA_PROJECT_ID / MASTRA_ORG_ID from the project's .env so deploys
  // auto-link to the project that `mastra init --observability` provisioned.
  loadDeployEnvFromDotenv(targetDir);
  const isHeadless = Boolean(process.env.MASTRA_API_TOKEN);
  const autoAccept = opts.yes ?? isHeadless;
  const skipPreflight = opts.skipPreflight || process.env.MASTRA_SKIP_PREFLIGHT === '1';

  p.intro('mastra server deploy');

  const packageName = getPackageName(targetDir);

  // Step 1: Auth
  let token: string;
  try {
    token = await getToken();
  } catch {
    p.log.error(`Authentication failed. Run: mastra auth login`);
    process.exit(1);
  }

  // Step 2: Load existing project config
  const projectConfig = await loadProjectConfig(targetDir, opts.config);

  // Step 3: Resolve org — flags and config are checked before requiring env vars
  const hasOrg = Boolean(process.env.MASTRA_ORG_ID || opts.org || projectConfig?.organizationId);
  const hasProject = Boolean(process.env.MASTRA_PROJECT_ID || opts.project || projectConfig?.projectId);
  if (isHeadless && (!hasOrg || !hasProject)) {
    throw new Error(
      'MASTRA_ORG_ID and MASTRA_PROJECT_ID (or --org/--project flags, or .mastra-project.json) are required when MASTRA_API_TOKEN is set',
    );
  }

  const { orgId, orgName } = await resolveOrg(token, projectConfig, opts.org);

  // Step 4: Resolve project
  const { projectId, projectName, projectSlug } = await resolveProject(
    token,
    orgId,
    projectConfig,
    opts.project,
    packageName,
    autoAccept,
  );

  // Step 5: Confirmation
  const isAlreadyLinked = projectConfig?.projectId === projectId && projectConfig?.organizationId === orgId;

  if (!isAlreadyLinked) {
    p.note(
      [`Organization:  ${orgName}`, `Project:       ${projectName}`, `Directory:     ${targetDir}`].join('\n'),
      'Deploy settings',
    );

    if (!autoAccept) {
      const confirmed = await p.confirm({
        message: 'Deploy with these settings?',
      });

      if (p.isCancel(confirmed) || !confirmed) {
        p.cancel('Deploy cancelled.');
        process.exit(0);
      }
    }

    await saveProjectConfig(
      targetDir,
      getProjectConfigToSave(projectId, projectName, projectSlug, orgId, projectConfig),
      opts.config,
    );
    p.log.success(`Saved ${opts.config || '.mastra-project.json'}`);
  } else {
    p.log.info(`Organization: ${orgName} (${orgId})`);
    p.log.info(`Project: ${projectName} (${projectId})`);
  }

  // Step 6: Build + Zip + Upload + Poll
  const s = p.spinner();

  // Check build staleness to determine if we need to rebuild
  const mastraDir = join(targetDir, 'src', 'mastra');
  const outputDirectory = join(targetDir, '.mastra');
  const staleness = await checkBuildStaleness(targetDir, mastraDir, outputDirectory);

  if (opts.skipBuild) {
    if (staleness.isStale && staleness.reason !== 'no-build') {
      // User explicitly skipped build, but sources have changed — warn them
      if (staleness.reason === 'hash-mismatch') {
        p.log.warn('Source files have changed since last build. Deploy may not reflect latest changes.');
      } else if (staleness.reason === 'no-manifest') {
        p.log.warn('No build manifest found. Cannot verify if build is up-to-date.');
      }
    }
    p.log.step('Skipping build (--skip-build)');
  } else if (staleness.isStale) {
    // Build is stale or doesn't exist — rebuild
    if (staleness.reason === 'hash-mismatch') {
      p.log.step('Source files changed, rebuilding...');
    }
    await runBuild(targetDir, { debug: opts.debug });
  } else {
    // Build is up-to-date — skip rebuild
    p.log.step('Build is up-to-date, skipping rebuild');
  }

  // Verify build output exists
  const outputEntry = join(targetDir, '.mastra', 'output', 'index.mjs');
  try {
    await access(outputEntry);
  } catch {
    throw new Error('.mastra/output/index.mjs not found — did the build succeed?');
  }

  const envVars = await readEnvVars(targetDir, { autoAccept, envFile: opts.envFile });
  const envCount = Object.keys(envVars).length;
  if (envCount > 0) {
    p.log.step(`Found ${envCount} env var(s)`);
  } else {
    p.log.step('No env vars found in selected env file');
  }

  // Pre-upload validation — catch USER-attributable errors before zipping/shipping.
  if (!skipPreflight) {
    const issues = await preflightBuildOutput(targetDir, envVars);
    const outcome = await printPreflightIssues(issues, { autoAccept });
    if (outcome === 'blocked') {
      p.cancel('Deploy blocked by preflight errors.');
      process.exit(1);
    }
    if (outcome === 'cancelled') {
      p.cancel('Deploy cancelled.');
      process.exit(0);
    }
  }

  s.start('Zipping build artifact...');
  const zipPath = await zipOutput(targetDir);
  const zipStat = await stat(zipPath);
  const sizeKB = zipStat.size / 1024;
  const sizeLabel = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)}MB` : `${sizeKB.toFixed(1)}KB`;
  s.stop(`Created ${sizeLabel} archive`);

  s.start('Uploading...');
  const zipBuffer = await readFile(zipPath);
  const deployResult = await uploadServerDeploy(token, orgId, projectId, zipBuffer, {
    projectName,
    envVars: envCount > 0 ? envVars : undefined,
    disablePlatformObservability: projectConfig?.disablePlatformObservability === true,
  });
  s.stop(`Deploy accepted: ${deployResult.id}`);

  await rm(zipPath, { force: true });

  p.log.step('Streaming deploy logs...');
  const finalStatus = await pollServerDeploy(deployResult.id, token, orgId);

  if (finalStatus.status === 'running') {
    p.outro(`Deploy succeeded! ${finalStatus.instanceUrl}`);
  } else if (finalStatus.status === 'failed') {
    p.log.error(`Deploy failed: ${finalStatus.error}`);
    process.exit(1);
  } else {
    p.log.warning(`Deploy ended with status: ${finalStatus.status}`);
    process.exit(1);
  }
}

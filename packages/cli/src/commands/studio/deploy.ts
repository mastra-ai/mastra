import { execSync } from 'node:child_process';
import { createWriteStream, readFileSync } from 'node:fs';
import { mkdir, rm, stat, access, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as p from '@clack/prompts';
import archiver from 'archiver';
import { fetchOrgs } from '../auth/api.js';
import { MASTRA_STUDIO_URL } from '../auth/client.js';
import { getToken, getCurrentOrgId } from '../auth/credentials.js';
import { fetchProjects, createProject, uploadDeploy, pollDeploy } from './platform-api.js';
import { loadProjectConfig, saveProjectConfig } from './project-config.js';

function elapsed(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

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
    // Strip org scope if present (e.g. @org/my-app → my-app)
    return raw.startsWith('@') ? (raw.split('/')[1] ?? raw) : raw;
  } catch {
    return null;
  }
}

function getGitBranch(projectDir: string): string | null {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

function getMastraVersion(projectDir: string): string | null {
  try {
    const pkgPath = join(projectDir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return deps['mastra'] ?? null;
  } catch {
    return null;
  }
}
function runBuild(projectDir: string): void {
  const localMastra = join(projectDir, 'node_modules', '.bin', 'mastra');
  p.log.step('Running mastra build...');
  try {
    execSync(`"${localMastra}" build`, {
      cwd: projectDir,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' },
    });
  } catch {
    throw new Error('mastra build failed');
  }
  console.info('');
}

async function zipOutput(projectDir: string): Promise<string> {
  const outputDir = join(projectDir, '.mastra', 'output');
  const tmpDir = join(tmpdir(), 'mastra-deploy');
  await mkdir(tmpDir, { recursive: true });
  const zipPath = join(tmpDir, `deploy-${Date.now()}.zip`);

  return new Promise((resolvePromise, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', () => resolvePromise(zipPath));
    archive.on('error', reject);

    archive.pipe(output);
    archive.glob('**', { cwd: outputDir, ignore: ['node_modules/**'] }, { prefix: 'output' });
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

async function readEnvVars(projectDir: string): Promise<Record<string, string>> {
  const vars: Record<string, string> = {};
  for (const envFile of ['.env.production', '.env.local', '.env']) {
    try {
      const content = await readFile(join(projectDir, envFile), 'utf-8');
      Object.assign(vars, parseEnvFile(content));
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw err;
    }
  }
  return vars;
}

/* ------------------------------------------------------------------ */
/*  Resolve org                                                       */
/* ------------------------------------------------------------------ */

async function resolveOrg(
  token: string,
  projectConfig: { organizationId?: string } | null,
  flagOrg?: string,
): Promise<{ orgId: string; orgName: string }> {
  // 0. MASTRA_ORG_ID env var (CI/CD headless path)
  const envOrgId = process.env.MASTRA_ORG_ID;
  if (envOrgId) {
    return { orgId: envOrgId, orgName: envOrgId };
  }

  // 1. CLI flag
  if (flagOrg) {
    const orgs = await fetchOrgs(token);
    const match = orgs.find(o => o.id === flagOrg);
    return { orgId: flagOrg, orgName: match?.name ?? flagOrg };
  }

  // 2. project.json (only if user is a member of that org)
  if (projectConfig?.organizationId) {
    const orgs = await fetchOrgs(token);
    const match = orgs.find(o => o.id === projectConfig.organizationId);
    if (match) {
      return { orgId: match.id, orgName: match.name };
    }
  }

  // 3. credentials currentOrgId
  const currentOrgId = await getCurrentOrgId();
  const orgs = await fetchOrgs(token);

  if (currentOrgId) {
    const match = orgs.find(o => o.id === currentOrgId);
    if (match) {
      return { orgId: match.id, orgName: match.name };
    }
  }

  // 4. Auto-select if only 1 org
  if (orgs.length === 1) {
    return { orgId: orgs[0]!.id, orgName: orgs[0]!.name };
  }

  // 5. Interactive picker
  if (orgs.length === 0) {
    throw new Error(`You have no organizations. Please create one at ${MASTRA_STUDIO_URL}`);
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

type ProjectResolution =
  | { existing: true; projectId: string; projectName: string; projectSlug: string }
  | { existing: false; projectName: string };

/**
 * Attempts to resolve an existing project without creating one.
 * Returns { existing: true, ... } if found, or { existing: false, projectName } if a new project should be created.
 * This allows the caller to show a confirmation prompt before actually creating the project.
 */
async function resolveProject(
  token: string,
  orgId: string,
  projectConfig: { projectId?: string; projectName?: string; projectSlug?: string; organizationId?: string } | null,
  flagProject?: string,
  defaultName?: string | null,
): Promise<ProjectResolution> {
  // 0. MASTRA_PROJECT_ID env var (CI/CD headless path)
  const envProjectId = process.env.MASTRA_PROJECT_ID;
  if (envProjectId) {
    return { existing: true, projectId: envProjectId, projectName: envProjectId, projectSlug: envProjectId };
  }

  // 1. CLI flag — match by slug first, then id
  if (flagProject) {
    const projects = await fetchProjects(token, orgId);
    const match = projects.find(proj => proj.slug === flagProject || proj.id === flagProject);
    if (match) {
      return { existing: true, projectId: match.id, projectName: match.name, projectSlug: match.slug ?? match.name };
    }
    return { existing: false, projectName: flagProject };
  }

  // 2. project.json (only if same org)
  if (projectConfig?.projectId && projectConfig.organizationId === orgId) {
    return {
      existing: true,
      projectId: projectConfig.projectId,
      projectName: projectConfig.projectName ?? projectConfig.projectId,
      projectSlug: projectConfig.projectSlug ?? projectConfig.projectName ?? projectConfig.projectId,
    };
  }

  // 3. No existing project — return the name so caller can create after confirmation
  const name = defaultName;
  if (!name) {
    throw new Error('Could not determine project name from package.json. Use --project to specify one.');
  }

  return { existing: false, projectName: name };
}

/* ------------------------------------------------------------------ */
/*  Main deploy action                                                */
/* ------------------------------------------------------------------ */

export async function deployAction(
  dir: string | undefined,
  opts: { org?: string; project?: string; yes?: boolean; config?: string; skipBuild?: boolean },
) {
  const targetDir = resolve(dir || process.cwd());
  const isHeadless = Boolean(process.env.MASTRA_API_TOKEN);
  if (isHeadless && (!process.env.MASTRA_ORG_ID || !process.env.MASTRA_PROJECT_ID)) {
    throw new Error('MASTRA_ORG_ID and MASTRA_PROJECT_ID are required when MASTRA_API_TOKEN is set');
  }
  const autoAccept = opts.yes ?? isHeadless;

  p.intro('mastra studio deploy');

  // Gather context
  const packageName = getPackageName(targetDir);
  const gitBranch = getGitBranch(targetDir);
  const mastraVersion = getMastraVersion(targetDir);

  // Step 1: Auth
  const token = await getToken();

  // Step 2: Load existing project config
  const projectConfig = await loadProjectConfig(targetDir, opts.config);

  // Step 3: Resolve org
  const { orgId, orgName } = await resolveOrg(token, projectConfig, opts.org);

  // Step 4: Resolve project (does NOT create yet — waits for confirmation)
  const resolution = await resolveProject(token, orgId, projectConfig, opts.project, packageName);

  let projectId: string;
  let projectName: string;
  let projectSlug: string;

  if (resolution.existing) {
    // Existing project found
    projectId = resolution.projectId;
    projectName = resolution.projectName;
    projectSlug = resolution.projectSlug;

    const isAlreadyLinked = projectConfig?.projectId === projectId && projectConfig?.organizationId === orgId;

    p.note(
      [
        `Organization:  ${orgName}`,
        `Project:       ${projectName}`,
        `Directory:     ${targetDir}`,
        ...(gitBranch ? [`Git branch:    ${gitBranch}`] : []),
        ...(mastraVersion ? [`Mastra:        ${mastraVersion}`] : []),
      ].join('\n'),
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

    if (!isAlreadyLinked) {
      await saveProjectConfig(targetDir, { projectId, projectName, projectSlug, organizationId: orgId }, opts.config);
      p.log.success(`Saved ${opts.config || '.mastra-project.json'}`);
    }
  } else {
    // New project — show confirmation BEFORE creating
    projectName = resolution.projectName;

    p.note(
      [
        `Organization:  ${orgName}`,
        `Project:       ${projectName} (new)`,
        `Directory:     ${targetDir}`,
        ...(gitBranch ? [`Git branch:    ${gitBranch}`] : []),
        ...(mastraVersion ? [`Mastra:        ${mastraVersion}`] : []),
      ].join('\n'),
      'Deploy settings',
    );

    if (!autoAccept) {
      const confirmed = await p.confirm({
        message: 'Create project and deploy?',
      });

      if (p.isCancel(confirmed) || !confirmed) {
        p.cancel('Deploy cancelled.');
        process.exit(0);
      }
    }

    // NOW create the project (after user confirmed)
    const project = await createProject(token, orgId, projectName);
    projectId = project.id;
    projectSlug = project.slug ?? project.name;
    p.log.success(`Created project "${projectName}"`);

    // Save the project link
    await saveProjectConfig(targetDir, { projectId, projectName, projectSlug, organizationId: orgId }, opts.config);
    p.log.success(`Saved ${opts.config || '.mastra-project.json'}`);
  }

  // Step 6: Build + Zip + Upload + Poll
  const s = p.spinner();
  const tTotal = performance.now();

  let t: number;

  if (opts.skipBuild) {
    p.log.step('Skipping build (--skip-build)');
  } else {
    t = performance.now();
    runBuild(targetDir);
    p.log.step(`Build completed (${elapsed(performance.now() - t)})`);
  }

  // Verify build output exists
  const outputEntry = join(targetDir, '.mastra', 'output', 'index.mjs');
  try {
    await access(outputEntry);
  } catch {
    throw new Error('.mastra/output/index.mjs not found — did the build succeed?');
  }

  t = performance.now();
  s.start('Zipping build artifact...');
  const zipPath = await zipOutput(targetDir);
  const zipStat = await stat(zipPath);
  const sizeKB = zipStat.size / 1024;
  const sizeLabel = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)}MB` : `${sizeKB.toFixed(1)}KB`;
  s.stop(`Created ${sizeLabel} archive (${elapsed(performance.now() - t)})`);

  s.start('Reading environment variables...');
  const envVars = await readEnvVars(targetDir);
  const envCount = Object.keys(envVars).length;
  if (envCount > 0) {
    s.stop(`Found ${envCount} env var(s)`);
  } else {
    s.stop('No .env file found');
  }

  t = performance.now();
  s.start('Uploading...');
  const zipBuffer = await readFile(zipPath);
  const deployResult = await uploadDeploy(token, orgId, projectId, zipBuffer, {
    gitBranch: gitBranch ?? undefined,
    projectName,
    envVars: envCount > 0 ? envVars : undefined,
    mastraVersion: mastraVersion ?? undefined,
  });
  s.stop(`Uploaded (${elapsed(performance.now() - t)})`);

  await rm(zipPath, { force: true });

  p.log.step('Streaming deploy logs...');
  const finalStatus = await pollDeploy(deployResult.id, token, orgId);

  if (finalStatus.status === 'running') {
    p.outro(`Deploy succeeded in ${elapsed(performance.now() - tTotal)}! ${finalStatus.instanceUrl}`);
  } else if (finalStatus.status === 'failed') {
    p.log.error(`Deploy failed: ${finalStatus.error}`);
    process.exit(1);
  } else {
    p.log.warning(`Deploy ended with status: ${finalStatus.status}`);
    process.exit(1);
  }
}

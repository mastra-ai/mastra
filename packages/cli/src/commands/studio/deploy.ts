import { execSync } from 'node:child_process';
import { createWriteStream, accessSync } from 'node:fs';
import { mkdir, rm, stat, access, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as p from '@clack/prompts';
import archiver from 'archiver';
import { fetchOrgs } from '../auth/api.js';
import { getToken, getCurrentOrgId } from '../auth/credentials.js';
import { fetchProjects, createProject, uploadDeploy, pollDeploy } from './platform-api.js';
import { loadProjectConfig, saveProjectConfig } from './project-config.js';

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

function runBuild(projectDir: string): void {
  const outputFile = join(projectDir, '.mastra', 'output', 'index.mjs');

  try {
    accessSync(outputFile);
    p.log.step('Build output exists, skipping build');
    return;
  } catch {
    // No existing output — build it
  }

  const localMastra = join(projectDir, 'node_modules', '.bin', 'mastra');
  p.log.step('Running mastra build --studio...');
  try {
    execSync(`"${localMastra}" build --studio`, {
      cwd: projectDir,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' },
    });
  } catch {
    throw new Error('mastra build --studio failed');
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

function parseEnvFile(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
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
  for (const envFile of ['.env', '.env.local']) {
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

  // 2. project.json
  if (projectConfig?.organizationId) {
    const orgs = await fetchOrgs(token);
    const match = orgs.find(o => o.id === projectConfig.organizationId);
    return {
      orgId: projectConfig.organizationId,
      orgName: match?.name ?? projectConfig.organizationId,
    };
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
    throw new Error('You have no organizations. Please create one at https://app.mastra.ai');
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
  projectConfig: { projectId?: string; projectName?: string; organizationId?: string } | null,
  flagProject?: string,
  defaultName?: string | null,
): Promise<{ projectId: string; projectName: string }> {
  // 0. MASTRA_PROJECT_ID env var (CI/CD headless path)
  const envProjectId = process.env.MASTRA_PROJECT_ID;
  if (envProjectId) {
    return { projectId: envProjectId, projectName: envProjectId };
  }

  // 1. CLI flag
  if (flagProject) {
    const projects = await fetchProjects(token, orgId);
    const match = projects.find(proj => proj.id === flagProject);
    return { projectId: flagProject, projectName: match?.name ?? flagProject };
  }

  // 2. project.json (only if same org)
  if (projectConfig?.projectId && projectConfig.organizationId === orgId) {
    return {
      projectId: projectConfig.projectId,
      projectName: projectConfig.projectName ?? projectConfig.projectId,
    };
  }

  // 3. Auto-create from package name
  const name = defaultName;
  if (!name) {
    throw new Error('Could not determine project name from package.json. Use --project to specify one.');
  }

  const project = await createProject(token, orgId, name);
  return { projectId: project.id, projectName: project.name };
}

/* ------------------------------------------------------------------ */
/*  Main deploy action                                                */
/* ------------------------------------------------------------------ */

export async function deployAction(dir: string | undefined, opts: { org?: string; project?: string; yes?: boolean }) {
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

  // Step 1: Auth
  const token = await getToken();

  // Step 2: Load existing project config
  const projectConfig = await loadProjectConfig(targetDir);

  // Step 3: Resolve org
  const { orgId, orgName } = await resolveOrg(token, projectConfig, opts.org);

  // Step 4: Resolve project (pass packageName as default for new project creation)
  const { projectId, projectName } = await resolveProject(token, orgId, projectConfig, opts.project, packageName);

  // Step 5: Confirmation — show settings and let user verify (skipped with -y or if already linked)
  const isAlreadyLinked = projectConfig?.projectId === projectId && projectConfig?.organizationId === orgId;

  if (!isAlreadyLinked) {
    p.note(
      [
        `Organization:  ${orgName}`,
        `Project:       ${projectName}`,
        `Directory:     ${targetDir}`,
        ...(gitBranch ? [`Git branch:    ${gitBranch}`] : []),
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

    // Save the project link
    await saveProjectConfig(targetDir, {
      projectId,
      projectName,
      organizationId: orgId,
    });
    p.log.success('Saved .mastra/project.json');
  } else {
    // Already linked — just show a summary line
    p.log.info(`Organization: ${orgName} (${orgId})`);
    p.log.info(`Project: ${projectName} (${projectId})`);
    if (gitBranch) p.log.info(`Git branch: ${gitBranch}`);
  }

  // Step 6: Build + Zip + Upload + Poll
  const s = p.spinner();

  runBuild(targetDir);

  // Verify build output exists
  const outputEntry = join(targetDir, '.mastra', 'output', 'index.mjs');
  try {
    await access(outputEntry);
  } catch {
    throw new Error('.mastra/output/index.mjs not found — did the build succeed?');
  }

  s.start('Zipping build artifact...');
  const zipPath = await zipOutput(targetDir);
  const zipStat = await stat(zipPath);
  const sizeKB = zipStat.size / 1024;
  const sizeLabel = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)}MB` : `${sizeKB.toFixed(1)}KB`;
  s.stop(`Created ${sizeLabel} archive`);

  s.start('Reading environment variables...');
  const envVars = await readEnvVars(targetDir);
  const envCount = Object.keys(envVars).length;
  if (envCount > 0) {
    s.stop(`Found ${envCount} env var(s)`);
  } else {
    s.stop('No .env file found');
  }

  s.start('Uploading...');
  const zipBuffer = await readFile(zipPath);
  const deployResult = await uploadDeploy(token, orgId, projectId, zipBuffer, {
    gitBranch: gitBranch ?? undefined,
    projectName,
    envVars: envCount > 0 ? envVars : undefined,
  });
  s.stop(`Deploy accepted: ${deployResult.id}`);

  await rm(zipPath, { force: true });

  p.log.step('Streaming deploy logs...');
  const finalStatus = await pollDeploy(deployResult.id, token, orgId);

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

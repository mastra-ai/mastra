import { execSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, stat, access, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as p from '@clack/prompts';
import archiver from 'archiver';
import { fetchOrgs } from '../auth/api.js';
import { MASTRA_STUDIO_URL } from '../auth/client.js';
import { getToken, getCurrentOrgId } from '../auth/credentials.js';
import { loadProjectConfig, saveProjectConfig } from '../studio/project-config.js';
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
  const zipPath = join(tmpDir, `server-deploy-${Date.now()}.zip`);

  return new Promise((resolvePromise, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

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

async function readEnvVars(projectDir: string): Promise<Record<string, string>> {
  const vars: Record<string, string> = {};
  for (const envFile of ['.env', '.env.local', '.env.production']) {
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
): Promise<{ projectId: string; projectName: string; projectSlug: string }> {
  const envProjectId = process.env.MASTRA_PROJECT_ID;
  if (envProjectId) {
    return { projectId: envProjectId, projectName: envProjectId, projectSlug: envProjectId };
  }

  if (flagProject) {
    const projects = await fetchServerProjects(token, orgId);
    const match = projects.find(proj => proj.slug === flagProject || proj.id === flagProject);
    if (match) {
      return { projectId: match.id, projectName: match.name, projectSlug: match.slug ?? match.name };
    }
    return { projectId: flagProject, projectName: flagProject, projectSlug: flagProject };
  }

  if (projectConfig?.projectId && projectConfig.organizationId === orgId) {
    return {
      projectId: projectConfig.projectId,
      projectName: projectConfig.projectName ?? projectConfig.projectId,
      projectSlug: projectConfig.projectSlug ?? projectConfig.projectName ?? projectConfig.projectId,
    };
  }

  // Check if a project already exists matching the package name before creating
  const name = defaultName;
  if (!name) {
    throw new Error('Could not determine project name from package.json. Use --project to specify one.');
  }

  const existing = await fetchServerProjects(token, orgId);
  const match = existing.find(proj => proj.name === name || proj.slug === name);
  if (match) {
    return { projectId: match.id, projectName: match.name, projectSlug: match.slug ?? match.name };
  }

  const project = await createServerProject(token, orgId, name);
  return { projectId: project.id, projectName: project.name, projectSlug: project.slug ?? project.name };
}

/* ------------------------------------------------------------------ */
/*  Main deploy action                                                */
/* ------------------------------------------------------------------ */

export async function serverDeployAction(
  dir: string | undefined,
  opts: { org?: string; project?: string; yes?: boolean; config?: string },
) {
  const targetDir = resolve(dir || process.cwd());
  const isHeadless = Boolean(process.env.MASTRA_API_TOKEN);
  const autoAccept = opts.yes ?? isHeadless;

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
      {
        projectId,
        projectName,
        projectSlug,
        organizationId: orgId,
      },
      opts.config,
    );
    p.log.success(`Saved ${opts.config || '.mastra-project.json'}`);
  } else {
    p.log.info(`Organization: ${orgName} (${orgId})`);
    p.log.info(`Project: ${projectName} (${projectId})`);
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
  const deployResult = await uploadServerDeploy(token, orgId, projectId, zipBuffer, {
    projectName,
    envVars: envCount > 0 ? envVars : undefined,
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

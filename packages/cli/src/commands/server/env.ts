import { chmod, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { getToken, getCurrentOrgId } from '../auth/credentials.js';
import { loadProjectConfig } from '../studio/project-config.js';
import { parseEnvFile } from './deploy.js';
import { fetchServerProjects, getServerProjectEnv, updateServerProjectEnv } from './platform-api.js';

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

export async function resolveAuth(cliOrg?: string): Promise<{ token: string; orgId: string }> {
  const token = await getToken();
  const orgId = process.env.MASTRA_ORG_ID ?? cliOrg ?? (await getCurrentOrgId());
  if (!orgId) {
    throw new Error('No organization selected. Run: mastra auth orgs switch');
  }
  return { token, orgId };
}

export async function resolveProjectId(
  opts: { config?: string; project?: string },
  auth?: { token: string; orgId: string },
): Promise<string> {
  const envProjectId = process.env.MASTRA_PROJECT_ID;
  if (envProjectId) return envProjectId;

  if (opts.project) {
    if (auth) {
      const projects = await fetchServerProjects(auth.token, auth.orgId);
      const match = projects.find(p => p.slug === opts.project || p.id === opts.project);
      if (match) return match.id;
    }
    return opts.project;
  }

  const config = await loadProjectConfig(process.cwd(), opts.config);
  if (!config?.projectId) {
    throw new Error('No linked project found. Deploy first with `mastra server deploy` or set MASTRA_PROJECT_ID.');
  }
  return config.projectId;
}

/* ------------------------------------------------------------------ */
/*  mastra server env list                                             */
/* ------------------------------------------------------------------ */

export async function envListAction(opts: { config?: string }) {
  const { token, orgId } = await resolveAuth();
  const projectId = await resolveProjectId(opts);

  const envVars = await getServerProjectEnv(token, orgId, projectId);
  const keys = Object.keys(envVars);

  if (keys.length === 0) {
    console.info('\nNo environment variables set.\n');
    return;
  }

  console.info(`\n  Environment variables (${keys.length}):\n`);
  for (const key of keys.sort()) {
    // Show only the first 4 chars of the value to avoid leaking secrets
    const val = envVars[key]!;
    const masked = val.length > 4 ? val.slice(0, 4) + '...' : val;
    console.info(`    ${key}=${masked}`);
  }
  console.info('');
}

/* ------------------------------------------------------------------ */
/*  mastra server env set                                              */
/* ------------------------------------------------------------------ */

export async function envSetAction(key: string, value: string, opts: { config?: string }) {
  const { token, orgId } = await resolveAuth();
  const projectId = await resolveProjectId(opts);

  // Fetch current env vars, merge the new one, and PUT back
  const envVars = await getServerProjectEnv(token, orgId, projectId);
  envVars[key] = value;
  await updateServerProjectEnv(token, orgId, projectId, envVars);

  console.info(`\n  Set ${key} successfully.\n`);
}

/* ------------------------------------------------------------------ */
/*  mastra server env unset                                            */
/* ------------------------------------------------------------------ */

export async function envUnsetAction(key: string, opts: { config?: string }) {
  const { token, orgId } = await resolveAuth();
  const projectId = await resolveProjectId(opts);

  const envVars = await getServerProjectEnv(token, orgId, projectId);

  if (!(key in envVars)) {
    console.info(`\n  ${key} is not set.\n`);
    return;
  }

  delete envVars[key];
  await updateServerProjectEnv(token, orgId, projectId, envVars);

  console.info(`\n  Removed ${key} successfully.\n`);
}

/* ------------------------------------------------------------------ */
/*  mastra server env import                                           */
/* ------------------------------------------------------------------ */

export async function envImportAction(file: string, opts: { config?: string }) {
  const filePath = resolve(file);
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    throw new Error(`Could not read file: ${filePath}`);
  }

  const newVars = parseEnvFile(content);
  const newKeys = Object.keys(newVars);
  if (newKeys.length === 0) {
    console.info('\n  No variables found in file.\n');
    return;
  }

  const { token, orgId } = await resolveAuth();
  const projectId = await resolveProjectId(opts);

  // Merge with existing env vars (new values override existing)
  const envVars = await getServerProjectEnv(token, orgId, projectId);
  Object.assign(envVars, newVars);
  await updateServerProjectEnv(token, orgId, projectId, envVars);

  console.info(`\n  Imported ${newKeys.length} variable(s) from ${file}:\n`);
  for (const key of newKeys.sort()) {
    console.info(`    ${key}`);
  }
  console.info('');
}

/* ------------------------------------------------------------------ */
/*  mastra server env pull                                             */
/* ------------------------------------------------------------------ */

export async function envPullAction(file: string | undefined, opts: { config?: string; project?: string }) {
  const { token, orgId } = await resolveAuth();
  const projectId = await resolveProjectId(opts, { token, orgId });

  const envVars = await getServerProjectEnv(token, orgId, projectId);
  const keys = Object.keys(envVars);

  const target = file ?? '.env';
  const shellSafeKey = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const lines = ['# Pulled from Mastra Server — do not edit manually', ''];
  let skipped = 0;
  for (const key of keys.sort()) {
    if (!shellSafeKey.test(key)) {
      lines.push(`# Skipped unsafe key: ${key.replace(/[^\w.-]/g, '?')}`);
      skipped++;
      continue;
    }
    const value = envVars[key]!;
    // Always quote values to prevent shell metacharacter interpretation when sourced
    const escaped = value
      .replace(/\\/g, '\\\\')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`');
    lines.push(`${key}="${escaped}"`);
  }
  lines.push(''); // trailing newline

  const outputPath = resolve(target);
  await writeFile(outputPath, lines.join('\n'), { encoding: 'utf-8', mode: 0o600 });
  await chmod(outputPath, 0o600);

  const written = keys.length - skipped;
  if (written === 0) {
    console.info(`\n  No environment variables set in the project. Wrote empty ${target}.\n`);
  } else {
    console.info(
      `\n  Pulled ${written} variable(s) to ${target}.${skipped > 0 ? ` Skipped ${skipped} unsafe key(s).` : ''}\n`,
    );
  }
}

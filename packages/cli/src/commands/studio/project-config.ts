import { access, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

export const PROJECT_CONFIG_FILE = '.mastra-project.json';

export interface ServerConfig {
  host?: string;
  port?: number;
  protocol?: string;
  apiPrefix?: string;
}

export interface ProjectConfig {
  projectId: string;
  projectName: string;
  projectSlug?: string;
  organizationId: string;
  envFile?: string;
  envVars?: Record<string, string>;
  requestContextPresets?: Record<string, Record<string, unknown>> | string;
  server?: ServerConfig;
}

function resolveConfigPath(dir: string, configFile?: string): string {
  if (configFile) {
    return isAbsolute(configFile) ? configFile : join(dir, configFile);
  }
  return join(dir, PROJECT_CONFIG_FILE);
}

export async function loadProjectConfig(dir: string, configFile?: string): Promise<ProjectConfig | null> {
  try {
    const data = await readFile(resolveConfigPath(dir, configFile), 'utf-8');
    return JSON.parse(data) as ProjectConfig;
  } catch {
    return null;
  }
}

export async function saveProjectConfig(
  dir: string,
  config: Partial<ProjectConfig>,
  configFile?: string,
): Promise<void> {
  const path = resolveConfigPath(dir, configFile);
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await readFile(path, 'utf-8'));
  } catch {}
  const merged = { ...existing, ...config };
  await writeFile(path, JSON.stringify(merged, null, 2) + '\n');
}

export async function detectEnvFile(dir: string): Promise<string | undefined> {
  for (const candidate of ['.env.production', '.env.local', '.env']) {
    try {
      await access(join(dir, candidate));
      return candidate;
    } catch {}
  }
  return undefined;
}

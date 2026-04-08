import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

export const PROJECT_CONFIG_FILE = '.mastra-project.json';

export interface ProjectConfig {
  projectId: string;
  projectName: string;
  projectSlug?: string;
  organizationId: string;
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

export async function saveProjectConfig(dir: string, config: ProjectConfig, configFile?: string): Promise<void> {
  await writeFile(resolveConfigPath(dir, configFile), JSON.stringify(config, null, 2) + '\n');
}

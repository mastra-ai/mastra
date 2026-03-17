import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const PROJECT_CONFIG_FILE = '.mastra-project.json';

export interface ProjectConfig {
  projectId: string;
  projectName: string;
  organizationId: string;
}

export async function loadProjectConfig(dir: string): Promise<ProjectConfig | null> {
  try {
    const data = await readFile(join(dir, PROJECT_CONFIG_FILE), 'utf-8');
    return JSON.parse(data) as ProjectConfig;
  } catch {
    return null;
  }
}

export async function saveProjectConfig(dir: string, config: ProjectConfig): Promise<void> {
  await writeFile(join(dir, PROJECT_CONFIG_FILE), JSON.stringify(config, null, 2) + '\n');
}

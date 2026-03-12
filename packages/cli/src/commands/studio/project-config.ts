import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export interface ProjectConfig {
  projectId: string;
  projectName: string;
  organizationId: string;
}

export async function loadProjectConfig(dir: string): Promise<ProjectConfig | null> {
  try {
    const data = await readFile(join(dir, '.mastra', 'project.json'), 'utf-8');
    return JSON.parse(data) as ProjectConfig;
  } catch {
    return null;
  }
}

export async function saveProjectConfig(dir: string, config: ProjectConfig): Promise<void> {
  const mastraDir = join(dir, '.mastra');
  await mkdir(mastraDir, { recursive: true });
  await writeFile(join(mastraDir, 'project.json'), JSON.stringify(config, null, 2) + '\n');
}

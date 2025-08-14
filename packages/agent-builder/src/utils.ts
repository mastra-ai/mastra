import { exec as execNodejs } from 'child_process';
import { promisify } from 'util';
import { spawn as nodeSpawn } from 'child_process';
import { createRequire } from 'module';
import semver from 'semver';
import { readFile, writeFile, mkdir, stat, readdir } from 'fs/promises';
import { join, dirname, relative } from 'path';

export const exec = promisify(execNodejs);

export function spawn(command: string, args: string[], options: any) {
  return new Promise((resolve, reject) => {
    const childProcess = nodeSpawn(command, args, {
      // stdio: 'inherit',
      ...options,
    });
    childProcess.on('error', error => {
      reject(error);
    });
    let stderr = '';
    childProcess.stderr?.on('data', message => {
      stderr += message;
    });
    childProcess.on('close', code => {
      if (code === 0) {
        resolve(void 0);
      } else {
        reject(new Error(stderr));
      }
    });
  });
}

export async function spawnSWPM(cwd: string, command: string, packageNames: string[]) {
  await spawn(createRequire(import.meta.filename).resolve('swpm'), [command, ...packageNames], {
    cwd,
  });
}

// Utility functions
export function kindWeight(kind: string): number {
  const order = ['mcp-server', 'mcp-tool', 'tool', 'workflow', 'agent', 'integration'];
  const idx = order.indexOf(kind);
  return idx === -1 ? order.length : idx;
}

function resolveVersionRange(
  projectRange: string | undefined,
  templateRange: string,
): string | { conflict: string; project: string; template: string } {
  if (!projectRange) return templateRange;

  try {
    const intersection = semver.intersects(projectRange, templateRange, { includePrerelease: true });
    if (intersection) {
      // Find the highest version that satisfies both ranges
      const maxProject = semver.maxSatisfying(['1.0.0'], projectRange); // This is simplified
      const maxTemplate = semver.maxSatisfying(['1.0.0'], templateRange);
      return templateRange; // Prefer template range for now
    }
    return { conflict: 'version mismatch', project: projectRange, template: templateRange };
  } catch {
    return templateRange; // Fallback to template range
  }
}

async function safeReadJson(filePath: string): Promise<Record<string, any> | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, value: Record<string, any>): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf-8');
}

async function expandGlobPattern(baseDir: string, pattern: string): Promise<string[]> {
  const fullPath = join(baseDir, pattern);

  // Simple glob expansion - in practice, you'd use a proper glob library
  if (pattern.includes('**')) {
    const prefix = pattern.split('**')[0] || '';
    const prefixPath = join(baseDir, prefix);
    try {
      const results: string[] = [];
      const walkDir = async (dir: string): Promise<void> => {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          const relativePath = relative(baseDir, fullPath);
          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else if (relativePath.startsWith(prefix)) {
            results.push(relativePath);
          }
        }
      };
      await walkDir(prefixPath);
      return results;
    } catch {
      return [];
    }
  } else {
    // Exact file match
    try {
      await stat(fullPath);
      return [pattern];
    } catch {
      return [];
    }
  }
}

// Utility functions to work with Mastra templates
export async function fetchMastraTemplates(): Promise<
  Array<{
    slug: string;
    title: string;
    description: string;
    githubUrl: string;
    tags: string[];
    agents: string[];
    workflows: string[];
    tools: string[];
  }>
> {
  try {
    const response = await fetch('https://mastra.ai/api/templates.json');
    const data = (await response.json()) as Array<{
      slug: string;
      title: string;
      description: string;
      githubUrl: string;
      tags: string[];
      agents: string[];
      workflows: string[];
      tools: string[];
    }>;
    return data;
  } catch (error) {
    throw new Error(`Failed to fetch Mastra templates: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper to get a specific template by slug
export async function getMastraTemplate(slug: string) {
  const templates = await fetchMastraTemplates();
  const template = templates.find(t => t.slug === slug);
  if (!template) {
    throw new Error(`Template "${slug}" not found. Available templates: ${templates.map(t => t.slug).join(', ')}`);
  }
  return template;
}

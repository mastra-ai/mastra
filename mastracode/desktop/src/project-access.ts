import { randomUUID } from 'node:crypto';
import { realpath, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve, sep } from 'node:path';

interface StoredProjectAccess {
  version: 1;
  roots: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasErrorCode(value: unknown, code: string): boolean {
  return value instanceof Error && 'code' in value && value.code === code;
}

function isWithinRoot(path: string, root: string): boolean {
  return path === root || path.startsWith(root.endsWith(sep) ? root : `${root}${sep}`);
}

async function resolveDirectory(path: string): Promise<string | null> {
  try {
    const resolved = await realpath(path);
    return (await stat(resolved)).isDirectory() ? resolved : null;
  } catch {
    return null;
  }
}

function parseStoredRoots(value: unknown): string[] {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.roots)) return [];
  return value.roots.filter((root): root is string => typeof root === 'string' && root.length > 0);
}

export function projectPathMutation(method: string, pathname: string, body: unknown): unknown {
  if (!isRecord(body)) return undefined;
  if (method === 'POST' && pathname === '/api/agent-controller/code/sessions') {
    return isRecord(body.tags) ? body.tags.projectPath : undefined;
  }
  if (method === 'PUT' && /^\/api\/agent-controller\/code\/sessions\/[^/]+\/state$/.test(pathname)) {
    return isRecord(body.state) ? body.state.projectPath : undefined;
  }
  return undefined;
}

export class ProjectAccessPolicy {
  readonly #defaultRoot: string;
  readonly #storagePath: string;
  readonly #approvedRoots = new Set<string>();

  private constructor(defaultRoot: string, storagePath: string) {
    this.#defaultRoot = defaultRoot;
    this.#storagePath = storagePath;
  }

  static async load(storagePath: string, defaultRoot = homedir()): Promise<ProjectAccessPolicy> {
    const resolvedDefaultRoot = (await resolveDirectory(defaultRoot)) ?? resolve(defaultRoot);
    const policy = new ProjectAccessPolicy(resolvedDefaultRoot, storagePath);
    try {
      const stored: unknown = JSON.parse(await readFile(storagePath, 'utf8'));
      for (const root of parseStoredRoots(stored)) {
        const resolvedRoot = await resolveDirectory(root);
        if (resolvedRoot && !isWithinRoot(resolvedRoot, resolvedDefaultRoot)) {
          policy.#approvedRoots.add(resolvedRoot);
        }
      }
    } catch (error) {
      if (!hasErrorCode(error, 'ENOENT') && !(error instanceof SyntaxError)) throw error;
    }
    return policy;
  }

  additionalRoots(): readonly string[] {
    return [...this.#approvedRoots];
  }

  async approve(path: string): Promise<string> {
    const resolvedPath = await resolveDirectory(path);
    if (!resolvedPath) throw new Error('The selected project directory is unavailable');
    if (!isWithinRoot(resolvedPath, this.#defaultRoot)) {
      this.#approvedRoots.add(resolvedPath);
      await this.#persist();
    }
    return resolvedPath;
  }

  async isAllowed(path: string): Promise<boolean> {
    const resolvedPath = await resolveDirectory(path);
    if (!resolvedPath) return false;
    return [this.#defaultRoot, ...this.#approvedRoots].some(root => isWithinRoot(resolvedPath, root));
  }

  async #persist(): Promise<void> {
    const data: StoredProjectAccess = { version: 1, roots: [...this.#approvedRoots].sort() };
    await mkdir(dirname(this.#storagePath), { recursive: true });
    const temporaryPath = `${this.#storagePath}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryPath, this.#storagePath);
  }
}

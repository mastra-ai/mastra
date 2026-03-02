import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';

/**
 * FilesystemDB is a thin I/O layer for filesystem-based storage.
 * It manages reading/writing JSON files in a directory, similar to how
 * InMemoryDB holds Maps for in-memory storage.
 *
 * Each editor domain gets its own JSON file (e.g., `agents.json`, `prompt-blocks.json`).
 * Skills use a real file tree under `skills/` instead of JSON.
 */
export class FilesystemDB {
  readonly dir: string;

  /** In-memory cache of parsed domain data, keyed by filename */
  private cache = new Map<string, Record<string, unknown>>();

  private initialized = false;

  constructor(dir: string) {
    this.dir = dir;
  }

  /**
   * Initialize the storage directory. Called once; subsequent calls are no-ops.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.ensureDir();
    this.initialized = true;
  }

  /**
   * Ensure the storage directory and skills subdirectory exist.
   */
  ensureDir(): void {
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
    const skillsDir = join(this.dir, 'skills');
    if (!existsSync(skillsDir)) {
      mkdirSync(skillsDir, { recursive: true });
    }
  }

  // ==========================================================================
  // Domain-level JSON operations
  // ==========================================================================

  /**
   * Read a domain JSON file and return its entity map.
   * Uses in-memory cache; reads from disk on first access.
   */
  readDomain<T = Record<string, unknown>>(filename: string): Record<string, T> {
    if (this.cache.has(filename)) {
      return this.cache.get(filename) as Record<string, T>;
    }

    const filePath = join(this.dir, filename);
    let data: Record<string, T> = {};

    if (existsSync(filePath)) {
      try {
        const raw = readFileSync(filePath, 'utf-8');
        data = JSON.parse(raw, dateReviver) as Record<string, T>;
      } catch {
        // If the file is corrupted, start fresh
        data = {};
      }
    }

    this.cache.set(filename, data as Record<string, unknown>);
    return data;
  }

  /**
   * Write a domain's full entity map to its JSON file.
   * Uses atomic write (write to .tmp, then rename) to prevent corruption.
   */
  writeDomain<T = Record<string, unknown>>(filename: string, data: Record<string, T>): void {
    this.cache.set(filename, data as Record<string, unknown>);

    const filePath = join(this.dir, filename);
    const tmpPath = filePath + '.tmp';

    // Ensure parent directory exists
    const parentDir = dirname(filePath);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    renameSync(tmpPath, filePath);
  }

  /**
   * Clear all data from a domain JSON file.
   */
  clearDomain(filename: string): void {
    this.writeDomain(filename, {});
  }

  /**
   * Invalidate the in-memory cache for a domain, forcing a re-read from disk on next access.
   */
  invalidateCache(filename?: string): void {
    if (filename) {
      this.cache.delete(filename);
    } else {
      this.cache.clear();
    }
  }

  // ==========================================================================
  // Entity-level convenience methods (used by FilesystemVersionedHelpers)
  // ==========================================================================

  /**
   * Get a single entity by ID from a domain JSON file.
   */
  get<T>(filename: string, id: string): T | null {
    const data = this.readDomain<T>(filename);
    return data[id] ?? null;
  }

  /**
   * Get all entities from a domain JSON file as an array.
   */
  getAll<T>(filename: string): T[] {
    const data = this.readDomain<T>(filename);
    return Object.values(data);
  }

  /**
   * Set (create or update) an entity in a domain JSON file.
   */
  set<T>(filename: string, id: string, entity: T): void {
    const data = this.readDomain<T>(filename);
    data[id] = entity;
    this.writeDomain(filename, data);
  }

  /**
   * Remove an entity by ID from a domain JSON file. No-op if not found.
   */
  remove(filename: string, id: string): void {
    const data = this.readDomain(filename);
    if (id in data) {
      delete data[id];
      this.writeDomain(filename, data);
    }
  }

  // =========================================================================
  // Skills directory operations (real file tree, not JSON)
  // =========================================================================

  /**
   * Get the path to a skill's directory.
   */
  skillDir(skillName: string): string {
    return join(this.dir, 'skills', skillName);
  }

  /**
   * List all files in a skill's directory, returning relative paths.
   */
  listSkillFiles(skillName: string): string[] {
    const dir = this.skillDir(skillName);
    if (!existsSync(dir)) return [];
    return walkDir(dir).map(abs => relative(dir, abs).split(sep).join('/'));
  }

  /**
   * Read a file from a skill's directory.
   */
  readSkillFile(skillName: string, relativePath: string): Buffer | null {
    const filePath = join(this.skillDir(skillName), relativePath);
    if (!existsSync(filePath)) return null;
    try {
      return readFileSync(filePath);
    } catch {
      return null;
    }
  }

  /**
   * Write a file to a skill's directory.
   */
  writeSkillFile(skillName: string, relativePath: string, content: Buffer | string): void {
    const filePath = join(this.skillDir(skillName), relativePath);
    const parentDir = dirname(filePath);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }
    writeFileSync(filePath, content);
  }

  /**
   * Delete a skill's entire directory.
   */
  deleteSkillDir(skillName: string): void {
    const dir = this.skillDir(skillName);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

/**
 * JSON reviver that converts ISO date strings back to Date objects.
 */
function dateReviver(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return value;
}

/**
 * Recursively walk a directory and return all file paths.
 */
function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

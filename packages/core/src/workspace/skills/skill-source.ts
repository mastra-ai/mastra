/**
 * SkillSource - Minimal interface for loading skills.
 *
 * This abstraction allows skills to be loaded from different sources:
 * - WorkspaceFilesystem (full CRUD support)
 * - LocalSkillSource (read-only from local disk)
 *
 * The interface only includes methods needed for discovery and reading.
 * Write operations (create/update/delete) require a full WorkspaceFilesystem.
 */

/**
 * Minimal file stat info needed for staleness checks.
 */
export interface SkillSourceStat {
  /** Last modification time */
  modifiedAt: Date;
}

/**
 * Directory entry from readdir.
 */
export interface SkillSourceEntry {
  /** Entry name (file or directory name) */
  name: string;
  /** Entry type */
  type: 'file' | 'directory';
}

/**
 * Minimal read-only interface for loading skills.
 *
 * This is the subset of WorkspaceFilesystem methods needed for skill discovery.
 * Implementations can be backed by workspace filesystem, local disk, or other sources.
 */
export interface SkillSource {
  /**
   * Check if a path exists.
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get file/directory stat info.
   * Only modifiedAt is required for staleness checks.
   */
  stat(path: string): Promise<SkillSourceStat>;

  /**
   * Read a file's contents.
   */
  readFile(path: string): Promise<string | Buffer>;

  /**
   * List directory contents.
   */
  readdir(path: string): Promise<SkillSourceEntry[]>;
}

/**
 * Type guard to check if a source supports write operations.
 * WorkspaceFilesystem has writeFile, mkdir, rmdir - SkillSource doesn't.
 */
export function isWritableSource(source: SkillSource): source is SkillSource & {
  writeFile(path: string, content: string | Buffer): Promise<void>;
  mkdir(path: string): Promise<void>;
  rmdir(path: string, options?: { recursive?: boolean }): Promise<void>;
} {
  return (
    'writeFile' in source &&
    typeof (source as any).writeFile === 'function' &&
    'mkdir' in source &&
    typeof (source as any).mkdir === 'function' &&
    'rmdir' in source &&
    typeof (source as any).rmdir === 'function'
  );
}

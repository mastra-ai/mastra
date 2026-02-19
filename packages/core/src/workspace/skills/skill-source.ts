/**
 * SkillSource - Minimal interface for loading skills.
 *
 * This abstraction allows skills to be loaded from different sources:
 * - WorkspaceFilesystem
 * - LocalSkillSource (read-only from local disk)
 *
 * The interface only includes methods needed for discovery and reading.
 */

/**
 * File stat info for skill sources.
 * Aligned with FileStat from WorkspaceFilesystem.
 */
export interface SkillSourceStat {
  /** File or directory name */
  name: string;
  /** 'file' or 'directory' */
  type: 'file' | 'directory';
  /** Size in bytes (0 for directories) */
  size: number;
  /** Creation time */
  createdAt: Date;
  /** Last modification time */
  modifiedAt: Date;
  /** MIME type (for files) */
  mimeType?: string;
}

/**
 * Directory entry from readdir.
 */
export interface SkillSourceEntry {
  /** Entry name (file or directory name) */
  name: string;
  /** Entry type */
  type: 'file' | 'directory';
  /** Whether this entry is a symbolic link */
  isSymlink?: boolean;
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

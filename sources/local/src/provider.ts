import type { ChangeEvent, ProjectSource, ProjectSourceProvider } from '@mastra/admin';

import type { MastraProjectDetector } from './detector';
import { detector as defaultDetector } from './detector';
import { DirectoryScanner } from './scanner';
import type { LocalProjectSource as LocalProjectSourceType, LocalProjectSourceConfig } from './types';
import { generateProjectId, isDirectory, isPathAccessible, resolvePath } from './utils';
import { ProjectWatcher } from './watcher';

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<Omit<LocalProjectSourceConfig, 'basePaths'>> = {
  include: ['*'],
  exclude: ['node_modules', '.git', 'dist', 'build', '.next', '.turbo'],
  maxDepth: 2,
  watchChanges: false,
  watchDebounceMs: 300,
};

/**
 * Local filesystem project source provider.
 *
 * Discovers Mastra projects from configured directories on the local filesystem.
 * Ideal for development and self-hosted deployments.
 *
 * @example
 * ```typescript
 * const source = new LocalProjectSource({
 *   basePaths: ['/home/user/projects'],
 *   watchChanges: true, // Enable for dev mode
 * });
 *
 * // List all discovered projects
 * const projects = await source.listProjects('team-1');
 *
 * // Get a specific project
 * const project = await source.getProject('local_abc123');
 *
 * // Watch for changes
 * const cleanup = source.watchChanges(project, (event) => {
 *   console.log('File changed:', event.path);
 * });
 * ```
 */
export class LocalProjectSource implements ProjectSourceProvider {
  readonly type = 'local' as const;

  private readonly config: Required<LocalProjectSourceConfig>;
  private readonly detector: MastraProjectDetector;
  private readonly scanner: DirectoryScanner;
  private projectCache: Map<string, LocalProjectSourceType> = new Map();
  private lastScanTime: number = 0;
  private readonly cacheTTL = 30000; // 30 seconds

  constructor(config: LocalProjectSourceConfig, detector?: MastraProjectDetector, scanner?: DirectoryScanner) {
    // Validate and resolve base paths
    if (!config.basePaths || config.basePaths.length === 0) {
      throw new Error('LocalProjectSource requires at least one base path');
    }

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      basePaths: config.basePaths.map(resolvePath),
    };

    this.detector = detector ?? defaultDetector;
    this.scanner = scanner ?? new DirectoryScanner(this.detector);
  }

  /**
   * List available projects from configured base paths.
   *
   * @param _teamId - Team ID (not used for local source, included for interface compatibility)
   * @returns List of discovered project sources
   */
  async listProjects(_teamId: string): Promise<ProjectSource[]> {
    // Check if cache is still valid
    const now = Date.now();
    if (now - this.lastScanTime < this.cacheTTL && this.projectCache.size > 0) {
      return Array.from(this.projectCache.values());
    }

    // Scan all configured paths
    const result = await this.scanner.scanMultiple(this.config.basePaths, {
      include: this.config.include,
      exclude: this.config.exclude,
      maxDepth: this.config.maxDepth,
    });

    // Update cache
    this.projectCache.clear();
    for (const project of result.projects) {
      this.projectCache.set(project.id, project);
    }
    this.lastScanTime = now;

    // Log any errors (non-fatal)
    if (result.errors.length > 0) {
      console.warn(`LocalProjectSource: ${result.errors.length} errors during scan:`, result.errors);
    }

    return result.projects;
  }

  /**
   * Get a specific project by ID.
   *
   * @param projectId - Project ID (generated from path hash)
   * @returns Project source details
   * @throws Error if project not found
   */
  async getProject(projectId: string): Promise<ProjectSource> {
    // Check cache first
    if (this.projectCache.has(projectId)) {
      const cached = this.projectCache.get(projectId)!;
      // Verify the project still exists
      if (await isDirectory(cached.path)) {
        return cached;
      }
      // Remove stale cache entry
      this.projectCache.delete(projectId);
    }

    // Refresh cache and try again
    await this.listProjects(''); // teamId not used

    const project = this.projectCache.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    return project;
  }

  /**
   * Validate that a project source is accessible.
   *
   * @param source - Project source to validate
   * @returns True if the project path exists and is accessible
   */
  async validateAccess(source: ProjectSource): Promise<boolean> {
    if (source.type !== 'local') {
      return false;
    }

    // Check path exists and is accessible
    if (!(await isPathAccessible(source.path))) {
      return false;
    }

    // Check it's still a valid Mastra project
    return this.detector.isMastraProject(source.path);
  }

  /**
   * Get the local path to the project.
   * For local sources, returns the path directly (no copying needed).
   *
   * @param source - Project source
   * @param _targetDir - Target directory (ignored for local source)
   * @returns Local filesystem path
   */
  async getProjectPath(source: ProjectSource, _targetDir: string): Promise<string> {
    // For local source, just return the path directly
    // Runners use the project in-place
    if (!(await this.validateAccess(source))) {
      throw new Error(`Project path is not accessible: ${source.path}`);
    }

    return source.path;
  }

  /**
   * Watch for file changes in a project.
   *
   * @param source - Project source to watch
   * @param callback - Callback for change events
   * @returns Cleanup function to stop watching
   */
  watchChanges(source: ProjectSource, callback: (event: ChangeEvent) => void): () => void {
    if (!this.config.watchChanges) {
      console.warn('LocalProjectSource: watchChanges is disabled in config');
      return () => {}; // No-op cleanup
    }

    const watcher = new ProjectWatcher({
      debounceMs: this.config.watchDebounceMs,
    });

    return watcher.watch(source as LocalProjectSourceType, callback);
  }

  /**
   * Manually add a project path to the source.
   * Useful for adding projects outside the configured base paths.
   *
   * @param projectPath - Absolute path to the project
   * @returns Added project source
   * @throws Error if not a valid Mastra project
   */
  async addProject(projectPath: string): Promise<LocalProjectSourceType> {
    const resolvedPath = resolvePath(projectPath);

    // Verify it's a valid Mastra project
    const isValid = await this.detector.isMastraProject(resolvedPath);
    if (!isValid) {
      throw new Error(`Not a valid Mastra project: ${resolvedPath}`);
    }

    // Get metadata
    const metadata = await this.detector.getProjectMetadata(resolvedPath);

    const project: LocalProjectSourceType = {
      id: generateProjectId(resolvedPath),
      name: metadata.name,
      type: 'local',
      path: resolvedPath,
      metadata,
    };

    // Add to cache
    this.projectCache.set(project.id, project);

    return project;
  }

  /**
   * Remove a project from the cache.
   * Does not delete the actual project files.
   *
   * @param projectId - Project ID to remove
   */
  removeProject(projectId: string): void {
    this.projectCache.delete(projectId);
  }

  /**
   * Clear the project cache, forcing a rescan on next listProjects call.
   */
  clearCache(): void {
    this.projectCache.clear();
    this.lastScanTime = 0;
  }

  /**
   * Get the current configuration.
   */
  getConfig(): Readonly<Required<LocalProjectSourceConfig>> {
    return { ...this.config };
  }
}

import type { ChangeEvent, ProjectSource } from '../types';

/**
 * Abstract interface for project source operations.
 *
 * Implementations:
 * - LocalProjectSource (sources/local/)
 * - GitHubProjectSource (sources/github/) - future
 */
export interface ProjectSourceProvider {
  /** Source type identifier */
  readonly type: 'local' | 'github' | string;

  /**
   * List available projects/repos.
   *
   * @param teamId - Team ID for filtering (used by GitHub for installations)
   * @returns List of project sources
   */
  listProjects(teamId: string): Promise<ProjectSource[]>;

  /**
   * Get project source details.
   *
   * @param projectId - Project source ID
   * @returns Project source details
   */
  getProject(projectId: string): Promise<ProjectSource>;

  /**
   * Validate that a project source is accessible.
   *
   * @param source - Project source to validate
   * @returns True if accessible
   */
  validateAccess(source: ProjectSource): Promise<boolean>;

  /**
   * Get the local path to the project.
   * For local sources, returns the path directly.
   * For GitHub, clones to targetDir.
   *
   * @param source - Project source
   * @param targetDir - Target directory for cloning (used by GitHub)
   * @returns Local filesystem path
   */
  getProjectPath(source: ProjectSource, targetDir: string): Promise<string>;

  /**
   * Watch for file changes in a project.
   * Optional - primarily for local development.
   *
   * @param source - Project source to watch
   * @param callback - Callback for change events
   * @returns Cleanup function to stop watching
   */
  watchChanges?(source: ProjectSource, callback: (event: ChangeEvent) => void): () => void;
}

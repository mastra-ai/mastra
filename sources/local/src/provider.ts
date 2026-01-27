import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import type { ProjectSourceProvider, ProjectSource, ChangeEvent } from '@mastra/admin';
import { DirectoryScanner } from './scanner';
import { MastraProjectDetector } from './detector';
import { copyDirectory } from './utils';
import type { LocalProjectSourceConfig } from './types';

export class LocalProjectSource implements ProjectSourceProvider {
  readonly type = 'local' as const;

  #config: LocalProjectSourceConfig;
  #scanner: DirectoryScanner;
  #detector: MastraProjectDetector;
  #cache: Map<string, ProjectSource> = new Map();
  #cacheExpiry: number = 0;
  #cacheTtlMs: number = 30000; // 30 seconds

  constructor(config: LocalProjectSourceConfig) {
    this.#config = {
      basePaths: config.basePaths,
      include: config.include ?? ['*'],
      exclude: config.exclude ?? ['node_modules', '.git', 'dist', '.next', '.mastra'],
      maxDepth: config.maxDepth ?? 3,
      watchChanges: config.watchChanges ?? false,
    };

    this.#scanner = new DirectoryScanner(this.#config);
    this.#detector = new MastraProjectDetector();
  }

  async listProjects(): Promise<ProjectSource[]> {
    // Return cached if valid
    if (Date.now() < this.#cacheExpiry && this.#cache.size > 0) {
      return Array.from(this.#cache.values());
    }

    const projects: ProjectSource[] = [];

    for (const basePath of this.#config.basePaths) {
      const directories = await this.#scanner.scan(basePath);

      for (const dir of directories) {
        const isMastraProject = await this.#detector.detect(dir);
        if (isMastraProject) {
          const metadata = await this.#detector.getMetadata(dir);
          const project: ProjectSource = {
            id: this.generateId(dir),
            name: metadata.name ?? basename(dir),
            type: 'local',
            path: dir,
            defaultBranch: 'main',
            metadata: metadata as Record<string, unknown>,
          };
          projects.push(project);
          this.#cache.set(project.id, project);
        }
      }
    }

    this.#cacheExpiry = Date.now() + this.#cacheTtlMs;
    return projects;
  }

  async getProject(projectId: string): Promise<ProjectSource | null> {
    // Refresh cache if needed
    if (Date.now() >= this.#cacheExpiry) {
      await this.listProjects();
    }
    return this.#cache.get(projectId) ?? null;
  }

  async validateAccess(source: ProjectSource): Promise<boolean> {
    return this.#detector.detect(source.path);
  }

  /**
   * Get project path - MUST copy to targetDir if provided.
   * This is critical: builds need isolated directories.
   */
  async getProjectPath(source: ProjectSource, targetDir?: string): Promise<string> {
    if (!targetDir) {
      // No target dir - return source path (for validation/listing only)
      return source.path;
    }

    // MUST copy source to target directory for builds
    await copyDirectory(source.path, targetDir, {
      exclude: this.#config.exclude,
    });

    return targetDir;
  }

  watchChanges?(source: ProjectSource, callback: (event: ChangeEvent) => void): () => void {
    if (!this.#config.watchChanges) {
      return () => {};
    }
    // TODO: Implement file watching with chokidar or similar
    return () => {};
  }

  private generateId(path: string): string {
    return createHash('sha256').update(path).digest('hex').substring(0, 16);
  }
}

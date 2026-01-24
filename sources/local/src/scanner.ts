import * as fs from 'node:fs/promises';

import fg from 'fast-glob';

import { MastraProjectDetector } from './detector';
import type { LocalProjectSource, ScanError, ScanOptions, ScanResult } from './types';
import { generateProjectId } from './utils';

/**
 * Scans directories to discover Mastra projects.
 */
export class DirectoryScanner {
  private readonly detector: MastraProjectDetector;

  constructor(detector?: MastraProjectDetector) {
    this.detector = detector ?? new MastraProjectDetector();
  }

  /**
   * Scan a base path for Mastra projects.
   *
   * @param options - Scan options
   * @returns Scan result with discovered projects
   */
  async scan(options: ScanOptions): Promise<ScanResult> {
    const { basePath, include, exclude, maxDepth } = options;

    const projects: LocalProjectSource[] = [];
    const skipped: string[] = [];
    const errors: ScanError[] = [];

    // Verify base path exists
    try {
      const stats = await fs.stat(basePath);
      if (!stats.isDirectory()) {
        errors.push({
          path: basePath,
          error: 'Path is not a directory',
          code: 'NOT_DIRECTORY',
        });
        return { projects, skipped, errors };
      }
    } catch (error) {
      errors.push({
        path: basePath,
        error: `Cannot access path: ${(error as Error).message}`,
        code: 'ACCESS_ERROR',
      });
      return { projects, skipped, errors };
    }

    // Generate glob patterns for scanning
    const patterns = this.generatePatterns(include, maxDepth);
    const ignorePatterns = this.generateIgnorePatterns(exclude);

    // Find all directories matching the patterns
    const directories = await fg(patterns, {
      cwd: basePath,
      onlyDirectories: true,
      absolute: true,
      ignore: ignorePatterns,
      deep: maxDepth,
      followSymbolicLinks: false,
    });

    // Also check the base path itself
    const directoriesToCheck = [basePath, ...directories];

    // Check each directory for Mastra projects
    for (const dir of directoriesToCheck) {
      try {
        const isMastraProject = await this.detector.isMastraProject(dir);

        if (isMastraProject) {
          const metadata = await this.detector.getProjectMetadata(dir);
          const projectSource: LocalProjectSource = {
            id: generateProjectId(dir),
            name: metadata.name,
            type: 'local',
            path: dir,
            defaultBranch: undefined, // Local projects don't have branches
            metadata,
          };
          projects.push(projectSource);
        } else if (dir !== basePath) {
          // Only record as skipped if it's not the base path
          skipped.push(dir);
        }
      } catch (error) {
        errors.push({
          path: dir,
          error: (error as Error).message,
        });
      }
    }

    return { projects, skipped, errors };
  }

  /**
   * Scan multiple base paths and merge results.
   *
   * @param basePaths - Array of base paths to scan
   * @param options - Common scan options (exclude, maxDepth, etc.)
   * @returns Combined scan result
   */
  async scanMultiple(basePaths: string[], options: Omit<ScanOptions, 'basePath'>): Promise<ScanResult> {
    const allProjects: LocalProjectSource[] = [];
    const allSkipped: string[] = [];
    const allErrors: ScanError[] = [];

    // Use a Set to track unique project paths (avoid duplicates)
    const seenPaths = new Set<string>();

    for (const basePath of basePaths) {
      const result = await this.scan({
        basePath,
        ...options,
      });

      // Add unique projects
      for (const project of result.projects) {
        if (!seenPaths.has(project.path)) {
          seenPaths.add(project.path);
          allProjects.push(project);
        }
      }

      allSkipped.push(...result.skipped);
      allErrors.push(...result.errors);
    }

    return {
      projects: allProjects,
      skipped: allSkipped,
      errors: allErrors,
    };
  }

  /**
   * Generate glob patterns from include patterns.
   */
  private generatePatterns(include: string[], maxDepth: number): string[] {
    if (include.length === 0) {
      // Default: scan immediate subdirectories
      return ['*'];
    }

    // Expand patterns to account for depth
    const patterns: string[] = [];
    for (const pattern of include) {
      patterns.push(pattern);
      // Add depth-based patterns if not already a glob
      if (!pattern.includes('**')) {
        for (let depth = 1; depth < maxDepth; depth++) {
          const depthPrefix = Array(depth).fill('*').join('/');
          patterns.push(`${depthPrefix}/${pattern}`);
        }
      }
    }

    return patterns;
  }

  /**
   * Generate ignore patterns from exclude patterns.
   */
  private generateIgnorePatterns(exclude: string[]): string[] {
    return exclude.map(pattern => {
      // Ensure patterns work at any depth
      if (pattern.startsWith('**/')) {
        return pattern;
      }
      return `**/${pattern}`;
    });
  }
}

/**
 * Singleton instance for convenience.
 */
export const scanner = new DirectoryScanner();

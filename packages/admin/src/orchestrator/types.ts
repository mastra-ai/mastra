import type { Build, Deployment, Project } from '../types';

/**
 * Build job in the queue.
 */
export interface BuildJob {
  buildId: string;
  queuedAt: Date;
  priority: number;
}

/**
 * Build context passed to the runner.
 */
export interface BuildContext {
  build: Build;
  deployment: Deployment;
  project: Project;
  envVars: Record<string, string>;
  sourceDir: string;
}

/**
 * Build result from the runner.
 */
export interface BuildResult {
  success: boolean;
  artifactPath?: string;
  logs: string;
  durationMs: number;
  error?: string;
}

/**
 * The `factory-environment-build` workflow: step one decides and starts a
 * build (`runEnvironmentBuild`), step two polls the provider until the build
 * settles and pins the active template on the project row. Registered by
 * `MastraFactory.prepare()` only when the sandbox has `builds`, and driven by
 * the Build now route, the per-project cron schedule, the GitHub push
 * hand-off and a settings change that touches the template.
 */

import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { resolveProjectEnvironment } from '../workspace.js';
import {
  ENVIRONMENT_BUILD_TRIGGERS,
  environmentBuildContext,
  redactCredentials,
  runEnvironmentBuild,
} from './build.js';
import type { EnvironmentBuildDeps, EnvironmentBuildOutcome } from './build.js';

export const ENVIRONMENT_BUILD_WORKFLOW_ID = 'factory-environment-build';
export const DEFAULT_BUILD_POLL_MS = 15_000;
export const MAX_BUILD_WAIT_MS = 30 * 60_000;

export const environmentBuildInputSchema = z.object({
  projectId: z.string().min(1),
  trigger: z.enum(ENVIRONMENT_BUILD_TRIGGERS),
});

const startOutputSchema = z.object({
  projectId: z.string(),
  outcome: z.enum(['started', 'skipped', 'unavailable', 'failed']),
  buildId: z.string().optional(),
  templateId: z.string().optional(),
  reason: z.string().optional(),
  heads: z.record(z.string(), z.string()).optional(),
});

export const environmentBuildOutputSchema = z.object({
  outcome: z.enum(['started', 'skipped', 'unavailable', 'failed']),
  buildId: z.string().optional(),
  templateId: z.string().optional(),
  reason: z.string().optional(),
  /** Where the started build ended: `ready`, `failed`, or `unknown` when the provider lost it or the wait ran out. */
  status: z.enum(['ready', 'failed', 'unknown']).optional(),
});

export type EnvironmentBuildWorkflowResult = z.infer<typeof environmentBuildOutputSchema>;

export interface EnvironmentBuildWorkflowOptions {
  sleep?: (ms: number) => Promise<void>;
  pollMs?: number;
  maxWaitMs?: number;
  /** Called with the first step's answer so a caller can return it without waiting for the poll. */
  onStart?: (runId: string, outcome: EnvironmentBuildOutcome) => void;
}

export function createEnvironmentBuildWorkflow(
  deps: EnvironmentBuildDeps,
  options: EnvironmentBuildWorkflowOptions = {},
) {
  const sleep = options.sleep ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const pollMs = options.pollMs ?? DEFAULT_BUILD_POLL_MS;
  const maxWaitMs = options.maxWaitMs ?? MAX_BUILD_WAIT_MS;
  const now = deps.now ?? (() => new Date());

  const start = createStep({
    id: 'start',
    inputSchema: environmentBuildInputSchema,
    outputSchema: startOutputSchema,
    execute: async ({ inputData, runId }) => {
      const outcome = await runEnvironmentBuild(deps, inputData);
      options.onStart?.(runId, outcome);
      return { projectId: inputData.projectId, ...outcome };
    },
  });

  const awaitBuild = createStep({
    id: 'await-build',
    inputSchema: startOutputSchema,
    outputSchema: environmentBuildOutputSchema,
    execute: async ({ inputData }): Promise<EnvironmentBuildWorkflowResult> => {
      const { projectId, heads, ...result } = inputData;
      if (result.outcome !== 'started' || !result.buildId || !heads) return result;
      const builds = deps.sandbox?.builds;
      const project = await deps.projects.getById({ id: projectId });
      if (!builds || !deps.sourceControl || !project) return { ...result, status: 'unknown' };
      const environment = await resolveProjectEnvironment(deps.sourceControl.storage, project);
      const ctx = environmentBuildContext(project, environment, heads, deps.sourceControl.versionControl);
      const startedAt = now().getTime();
      try {
        for (;;) {
          const build = await builds.get(ctx, environment.settings, result.buildId);
          if (build.status === 'ready') {
            const templateId = build.templateId ?? result.templateId ?? result.buildId;
            // A newer run may have replaced `last_build_id` while this one
            // polled; the pin is skipped then so the stale image never wins.
            const pinned = await deps.projects.pinActiveTemplate({
              id: project.id,
              buildId: result.buildId,
              templateId,
              heads,
            });
            deps.logger?.info(pinned ? 'environment build ready' : 'environment build ready but superseded', {
              factoryProjectId: project.id,
              templateId,
            });
            return { ...result, templateId, status: 'ready' };
          }
          if (build.status === 'failed' || build.status === 'unknown') {
            deps.logger?.info('environment build did not complete', {
              factoryProjectId: project.id,
              buildId: result.buildId,
              status: build.status,
              error: build.error,
            });
            return {
              ...result,
              status: build.status,
              ...(build.error ? { reason: redactCredentials(build.error) } : {}),
            };
          }
          if (now().getTime() - startedAt >= maxWaitMs) {
            return { ...result, status: 'unknown', reason: 'Build wait timed out.' };
          }
          await sleep(pollMs);
        }
      } catch (error) {
        const reason = redactCredentials(error instanceof Error ? error.message : String(error));
        deps.logger?.info('environment build status read failed', { factoryProjectId: project.id, reason });
        return { ...result, status: 'unknown', reason };
      }
    },
  });

  return createWorkflow({
    id: ENVIRONMENT_BUILD_WORKFLOW_ID,
    inputSchema: environmentBuildInputSchema,
    outputSchema: environmentBuildOutputSchema,
  })
    .then(start)
    .then(awaitBuild)
    .commit();
}

/**
 * Host-side `submit_plan` for Mastra Code sessions.
 *
 * The core builtin (`@mastra/core/tools`) is deliberately filesystem-free: it suspends with
 * the plan file `path` and expects the host to validate that path, read the plan, and fill
 * `title`/`plan` for approval rendering and history replay. This module is that host.
 *
 * Reading at suspend time is what keeps the approval card renderable: the plan body travels
 * with the suspension, so the card does not depend on a later file read that can fail once
 * the sandbox is recreated, the plans directory moves, or the file is edited after
 * submission (which would make the approved plan differ from the reviewed one).
 *
 * Registered through the AgentController's `tools` option, whose `controller` toolset is
 * flattened after `controllerBuiltIn`, so a tool with the same name replaces the builtin.
 */

import * as path from 'node:path';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import { createTool } from '@mastra/core/tools';
import type { SubmitPlanResumeData } from '@mastra/core/tools';
import { z } from 'zod';
import type { MastraCodeState } from '../schema.js';
import {
  getLocalPlansDir,
  getLocalPlansRelativeDir,
  isPlanFilePath,
  parsePlanContent,
  resolvePlanPath,
} from '../utils/plans.js';

const SUBMIT_PLAN_TOOL_ID = 'submit_plan';

export interface SubmitPlanToolOptions {
  /** Host-configured workspace-relative plans directory (e.g. `.artifacts/plans`). */
  plansDir?: string;
}

const resumeSchema = z.object({
  action: z.enum(['approved', 'rejected']),
  feedback: z.string().optional(),
  path: z.string().optional(),
  title: z.string().optional(),
  plan: z.string().optional(),
});

/**
 * Where to write a plan and which path to submit. Named in every rejection so the agent can
 * correct itself in one step instead of guessing.
 */
function plansDirGuidance(plansDir: string, plansDirAbs: string): string {
  return (
    `Write the plan to "${plansDirAbs}/<name>.md" and submit "${plansDir}/<name>.md" ` +
    `(e.g. "${plansDir}/add-dark-mode.md").`
  );
}

function planPathError(detail: string, guidance: string): string {
  return `Cannot submit plan: ${detail} ${guidance}`;
}

export function createSubmitPlanTool(options: SubmitPlanToolOptions = {}) {
  return createTool({
    id: SUBMIT_PLAN_TOOL_ID,
    description:
      'Submit a plan you wrote to a markdown file for review. Pass the `path` to that file (e.g. `<plans directory>/add-dark-mode.md`, using the plans directory your instructions name). Write/edit the file first — do not paste the plan contents here. Reuse the same file across revisions; only create a new file for a genuinely new plan. The user can approve, reject, or request changes. On approval, the system automatically switches to the default mode so you can implement.',
    inputSchema: z.object({
      path: z
        .string()
        .describe(
          'Path to the plan markdown file on disk, inside the plans directory your instructions name (e.g. `<plans directory>/add-dark-mode.md`).',
        ),
    }),
    suspendSchema: z.object({
      toolId: z.literal(SUBMIT_PLAN_TOOL_ID).optional(),
      path: z.string(),
      title: z.string().optional(),
      plan: z.string().optional(),
    }),
    resumeSchema,
    execute: async ({ path: submittedPath }, context: any) => {
      try {
        const resumeData = (context?.agent?.resumeData ?? context?.resumeData) as SubmitPlanResumeData | undefined;
        if (resumeData !== undefined) {
          if (resumeData.action === 'approved') {
            return {
              toolId: SUBMIT_PLAN_TOOL_ID,
              content: 'Plan approved. Proceed with implementation following the approved plan.',
              isError: false,
              submittedPlan: {
                title: resumeData.title,
                path: resumeData.path,
                plan: resumeData.plan,
                action: 'approved',
              },
            };
          }

          if (resumeData.feedback) {
            return {
              toolId: SUBMIT_PLAN_TOOL_ID,
              content: `Plan was not approved. The user wants revisions.\n\nUser feedback: ${resumeData.feedback}\n\nPlease revise the plan based on the feedback and submit again with submit_plan.`,
              isError: false,
              submittedPlan: {
                title: resumeData.title,
                path: resumeData.path,
                plan: resumeData.plan,
                action: 'rejected',
                feedback: resumeData.feedback,
              },
            };
          }

          // No inline feedback — the user will provide revision instructions in
          // their next chat message. Stop and wait for it.
          return {
            toolId: SUBMIT_PLAN_TOOL_ID,
            content:
              'Plan was not approved. The user will send revision instructions in their next message. Stop now and wait for the user to provide feedback before revising the plan.',
            isError: false,
            submittedPlan: {
              title: resumeData.title,
              path: resumeData.path,
              plan: resumeData.plan,
              action: 'rejected',
            },
          };
        }

        const suspend = context?.agent?.suspend ?? context?.suspend;
        if (!suspend) {
          // No agent context available: surface the submission as readable text so
          // non-agent execution paths still expose it to the model.
          return {
            content: `[Plan submitted for review]\n\nPath: ${submittedPath}`,
            isError: false,
          };
        }

        const agentControllerCtx = context?.requestContext?.get('controller') as
          | AgentControllerRequestContext<MastraCodeState>
          | undefined;
        const state = agentControllerCtx?.getState();
        const projectPath = state?.projectPath ?? process.cwd();
        const planOptions = { factoryProjectId: state?.factoryProjectId, plansDir: options.plansDir };
        const plansDir = getLocalPlansRelativeDir(planOptions);
        const plansDirAbs = getLocalPlansDir(projectPath, planOptions);

        const guidance = plansDirGuidance(plansDir, plansDirAbs);

        if (!isPlanFilePath(projectPath, submittedPath, planOptions)) {
          const resolved = resolvePlanPath(projectPath, submittedPath) ?? submittedPath;
          return {
            content: planPathError(
              `"${submittedPath}" resolves to "${resolved}", which is not a markdown file directly inside the plans directory "${plansDirAbs}".`,
              `${guidance} The plans directory is relative to the workspace root ("${projectPath}"), so it must not be prefixed with a repository directory name.`,
            ),
            isError: true,
          };
        }

        const resolvedPath = resolvePlanPath(projectPath, submittedPath)!;
        // Read through the workspace-relative form: the session filesystem is rooted at the
        // session workdir (a sandbox path in Factory), so this lands whether or not that root
        // matches the absolute `projectPath` we validated against.
        const relativePath = path.relative(projectPath, resolvedPath);
        const readPath =
          relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
            ? relativePath
            : resolvedPath;
        const filesystem = agentControllerCtx?.workspace?.filesystem ?? context?.workspace?.filesystem;
        if (!filesystem) {
          return {
            content: planPathError(
              `the session workspace filesystem is not available, so "${resolvedPath}" could not be read.`,
              guidance,
            ),
            isError: true,
          };
        }

        let raw: string;
        try {
          const content = await filesystem.readFile(readPath, { encoding: 'utf-8' });
          raw = typeof content === 'string' ? content : content.toString('utf-8');
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'unknown error';
          return {
            content: planPathError(
              `"${resolvedPath}" could not be read (${msg}).`,
              `${guidance} Write the plan file first, then submit its path.`,
            ),
            isError: true,
          };
        }

        const parsed = parsePlanContent(raw);
        if (parsed.plan.trim().length === 0) {
          return {
            content: planPathError(`"${resolvedPath}" is empty, so there is nothing to review.`, guidance),
            isError: true,
          };
        }

        // The plan body travels with the suspension: the approval card renders it inline
        // instead of re-reading the file, and the resume payload echoes the same text,
        // so the approved plan is exactly the reviewed one.
        await suspend({
          toolId: SUBMIT_PLAN_TOOL_ID,
          path: submittedPath,
          title: parsed.title,
          plan: parsed.plan,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return { content: `Failed to submit plan: ${msg}`, isError: true };
      }
    },
  }) as any;
}

export { SUBMIT_PLAN_TOOL_ID };

import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { z } from 'zod';

import { getFactoryAuthOrgId, getFactoryAuthUserFromContext, getFactoryAuthUserId } from '../auth.js';
import type { VersionControl } from '../capabilities/version-control.js';
import type { IntegrationTools } from '../integrations/base.js';
import {
  changedWorkflowFiles,
  renderWorkflowChanges,
  ensureLocalBranch,
  exportBranchCommits,
  isCheckoutOf,
  pushRepositoryBranch,
  refreshMergeRequestCheckout,
} from '../integrations/github/sandbox.js';
import { normalizedVerdictLine } from '../review-verdict.js';
import type { ExecutableSandbox } from '../sandbox/materialization.js';
import { resolveSessionWorkdir } from '../sandbox/session-sandbox.js';
import type { AuditAgentEmitter } from '../storage/domains/audit/domain.js';
import type {
  ProjectRepository,
  SourceControlRepository,
  SourceControlSession,
  SourceControlStorageHandle,
} from '../storage/domains/source-control/base.js';
import { APPROVAL_ARGS_LENGTH } from '../tools/reports.js';
import { mergeRequestNumberFromBranch } from '../work-item-branch.js';
import { environmentSlugs, findEnvironmentRepository, resolveSessionRepositories } from './environment-repositories.js';
import { updateSessionEnvironmentRepository } from './environment-state-processor.js';

type RepositorySessionState = {
  factoryProjectId?: string;
  projectRepositoryId?: string;
};

export interface SourceControlToolProvider {
  id: string;
  storage: SourceControlStorageHandle;
  versionControl: VersionControl;
}

interface SessionTarget {
  context: AgentControllerRequestContext<RepositorySessionState>;
  provider: SourceControlToolProvider;
  session: SourceControlSession;
  projectRepository: ProjectRepository;
  repository: SourceControlRepository;
  orgId: string;
  userId: string;
  /** True when the target is the link the session is filed under, the default. */
  ownRepository: boolean;
}

type ReviewEvent = 'approve' | 'request-changes' | 'comment';

/** Returns why a review's leading `Verdict:` line contradicts the submitted event, if it does. */
export function verdictEventMismatch(event: ReviewEvent, body: string | undefined): string | undefined {
  const match = /^verdict: ?(approve|request changes|changes requested)\b/.exec(normalizedVerdictLine(body) ?? '');
  if (!match) return undefined;
  const verdict = match[1] === 'approve' ? 'approve' : 'request changes';
  // GitLab has no request-changes state, so a blocking verdict is published as a comment review.
  const allowed: ReviewEvent[] = verdict === 'approve' ? ['approve'] : ['request-changes', 'comment'];
  if (allowed.includes(event)) return undefined;
  return `Review body opens with "Verdict: ${verdict}" but event is "${event}". Nothing was posted. Use event ${allowed
    .map(e => `"${e}"`)
    .join(' or ')} for this body, or regenerate the body for the verdict you intend.`;
}

const REVIEWED_HEAD_LINE = /^[\s*_>-]*reviewed head[*_]*:[*_]*\s*(.*)$/gim;
const FULL_SHA = /^`?([0-9a-f]{40}|[0-9a-f]{64})`?(?:\s|$)/i;

/**
 * Returns the full SHA named by the body's `Reviewed head:` lines, `null` when any line is malformed or the lines
 * disagree, or `undefined` when absent.
 */
export function reviewedHeadFromBody(body: string | undefined): string | null | undefined {
  const shas = new Set(
    [...(body ?? '').matchAll(REVIEWED_HEAD_LINE)].map(
      line => FULL_SHA.exec(line[1]!.trim())?.[1]?.toLowerCase() ?? null,
    ),
  );
  if (shas.size === 0) return undefined;
  if (shas.size > 1) return null;
  return [...shas][0];
}

function authIdentity(requestContext: RequestContext) {
  const user = getFactoryAuthUserFromContext(requestContext);
  return { orgId: getFactoryAuthOrgId(user), userId: getFactoryAuthUserId(user) };
}

async function resolveProviderSession(
  sessionId: string,
  providers: readonly SourceControlToolProvider[],
): Promise<{ provider: SourceControlToolProvider; session: SourceControlSession }> {
  const matches = (
    await Promise.all(
      providers.map(async provider => ({
        provider,
        session: await provider.storage.sessions.getBySessionId(sessionId),
      })),
    )
  ).filter(
    (match): match is { provider: SourceControlToolProvider; session: SourceControlSession } => match.session !== null,
  );
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? 'The active session is not backed by a source-control repository.'
        : 'The active session is ambiguous across source-control providers.',
    );
  }
  return matches[0]!;
}

async function resolveSessionTarget(
  requestContext: RequestContext,
  providers: readonly SourceControlToolProvider[],
  options: { repository?: string } = {},
): Promise<SessionTarget> {
  const context = requestContext.get('controller') as AgentControllerRequestContext<RepositorySessionState> | undefined;
  const { orgId, userId } = authIdentity(requestContext);
  if (!context?.sessionId || !orgId || !userId) {
    throw new Error('Source-control tools require an authenticated repository session.');
  }

  const { provider, session } = await resolveProviderSession(context.sessionId, providers);
  if (session.orgId !== orgId || (session.visibility === 'private' && session.userId !== userId)) {
    throw new Error('The active source-control session is not available to the authenticated user.');
  }
  const ownRepository = session.projectRepositoryId
    ? await provider.storage.projectRepositories.get({ orgId, id: session.projectRepositoryId })
    : null;
  if (!ownRepository) throw new Error('The active project repository was not found.');
  const state = context.getState();
  if (state.projectRepositoryId && state.projectRepositoryId !== ownRepository.id) {
    throw new Error('The active source-control session does not match its controller repository.');
  }
  const ownConnection = await provider.storage.connections.get({ orgId, id: ownRepository.connectionId });
  if (!ownConnection) throw new Error('The active source-control connection was not found.');
  if (state.factoryProjectId && state.factoryProjectId !== ownConnection.factoryProjectId) {
    throw new Error('The active source-control session does not match its Factory project.');
  }

  if (options.repository !== undefined) {
    const candidates = await resolveSessionRepositories({ sourceControl: provider.storage, session });
    const match = findEnvironmentRepository(candidates, options.repository);
    if (!match) {
      throw new Error(
        `Repository '${options.repository}' is not in this Factory's environment. Valid repositories: ${environmentSlugs(candidates).join(', ')}.`,
      );
    }
    return {
      context,
      provider,
      session,
      projectRepository: match.link,
      repository: match.repository,
      orgId,
      userId,
      ownRepository: match.link.id === ownRepository.id,
    };
  }

  const repository = await provider.storage.repositories.get({ orgId, id: ownRepository.repositoryId });
  if (!repository) throw new Error('The active source-control repository was not found.');
  return {
    context,
    provider,
    session,
    projectRepository: ownRepository,
    repository,
    orgId,
    userId,
    ownRepository: true,
  };
}

/**
 * The slugs a session may target and the one it is filed under, for the tool
 * descriptions. `undefined` when the session cannot be resolved; the tools
 * then describe the default without naming it.
 */
async function describeSessionRepositories(
  sessionId: string,
  providers: readonly SourceControlToolProvider[],
): Promise<{ slugs: string[]; own: string | undefined } | undefined> {
  try {
    const { provider, session } = await resolveProviderSession(sessionId, providers);
    const repositories = await resolveSessionRepositories({ sourceControl: provider.storage, session });
    const own = repositories.find(candidate => candidate.link.id === session.projectRepositoryId);
    return { slugs: environmentSlugs(repositories), own: own?.repository.slug };
  } catch {
    return undefined;
  }
}

function repositoryArgumentDescription(described: { slugs: string[]; own: string | undefined } | undefined): string {
  if (!described || described.slugs.length === 0) {
    return "Optional `repository` (owner/name) selects another repository of this Factory's environment; defaults to this session's repository.";
  }
  const fallback = described.own ? `${described.own}, this session's repository` : "this session's repository";
  return `Optional \`repository\` (owner/name) selects one of this Factory's environment repositories: ${described.slugs.join(', ')}. Defaults to ${fallback}.`;
}

function changeRequestId(value: string | number): string {
  return String(value);
}

function executableSandbox(value: unknown): WorkspaceSandbox & ExecutableSandbox {
  const sandbox = value as Partial<ExecutableSandbox> | undefined;
  if (!sandbox?.executeCommand) throw new Error('The active Factory workspace has no executable sandbox.');
  return sandbox as WorkspaceSandbox & ExecutableSandbox;
}

async function emitAgentAudit(
  audit: AuditAgentEmitter,
  requestContext: RequestContext,
  input: Parameters<AuditAgentEmitter['emitAgent']>[0]['input'],
): Promise<void> {
  try {
    await audit.emitAgent({ requestContext, input });
  } catch (error) {
    console.warn('[Audit] Failed to record brokered source-control action', {
      action: input.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Run events a session may re-run. Dispatched, scheduled, and release runs can
 * publish or deploy, so re-running them stays a human action outside Factory.
 */
const RERUNNABLE_EVENTS = new Set(['pull_request', 'push', 'merge_group']);

/** GitHub refuses to let an App token without `workflows` touch `.github/workflows/`. */
const WORKFLOW_PUSH_REFUSAL = /without `?workflows`? permission/i;

/** True when `listed` names each of `changed` exactly once and nothing else. */
function sameFiles(changed: readonly string[], listed: readonly string[]): boolean {
  const left = [...changed].sort();
  const right = [...listed].sort();
  return left.length === right.length && left.every((path, index) => path === right[index]);
}

/**
 * Validate a call before a person is asked to approve it, so the approval
 * notice (which shows the tool arguments) never describes something other than
 * what would run. `execute` re-runs the same check after approval. Calls whose
 * arguments would not fit in the notice are refused, so nothing approved is cut off.
 */
function refuseBeforeApproval(check: (input: any, workspace: unknown) => Promise<unknown>) {
  return async (input: any, context: { workspace?: unknown }) => {
    try {
      if ((JSON.stringify(input ?? {}) ?? '').length > APPROVAL_ARGS_LENGTH) {
        throw new Error(
          `The arguments are too long to show for approval (over ${APPROVAL_ARGS_LENGTH} characters). Nothing was run.`,
        );
      }
      await check(input, context.workspace);
      return undefined;
    } catch (error) {
      return { proceed: false as const, output: { error: error instanceof Error ? error.message : String(error) } };
    }
  };
}

/** Fixed server-side so an agent cannot publish under, and impersonate, another required check. */
export const FACTORY_TEST_CHECK_NAME = 'Factory Review / tests';

/**
 * Largest workflow change, as JSON-quoted text, that a person can be asked to approve.
 * Stays under the follower approval notice's argument limit so nothing approved is cut off.
 */
const MAX_WORKFLOW_CHANGES_LENGTH = 20_000;

const repositorySchema = z.object({ repository: z.string().trim().min(1).optional() });
const SHA = /^[0-9a-f]{40}$/;
const rerunSchema = repositorySchema.extend({
  runId: z.number().int().positive(),
  workflowName: z.string().min(1).describe('Name of the workflow the run belongs to.'),
  headBranch: z.string().min(1).describe('Branch the run ran on; must be the session branch.'),
  headSha: z.string().regex(SHA).describe('Commit the run ran on.'),
  failedJobsOnly: z.boolean().describe('Re-run only failed jobs (true) or the whole run (false).'),
});
type RerunInput = z.infer<typeof rerunSchema>;
const workflowPushSchema = repositorySchema.extend({
  headSha: z.string().regex(SHA).describe('Current head commit of the session branch.'),
  workflowFiles: z
    .array(z.string().min(1))
    .min(1)
    .describe('Every .github/workflows/ path the unpushed commits add, change, or delete.'),
  workflowChanges: z
    .string()
    .describe(
      "The end state of those workflow files, exactly as a refused call reports it: each file's full new content, or that it is deleted. The approver reads this.",
    ),
});
type WorkflowPushInput = z.infer<typeof workflowPushSchema>;
const changeRequestSchema = repositorySchema.extend({
  changeRequestId: z.union([z.string().trim().min(1), z.number().int().positive()]),
});

export async function createSourceControlTools({
  requestContext,
  providers,
  audit,
  testChecksEnabled,
  selfReviewApprovedHead,
  boundChangeRequestId,
}: {
  requestContext: RequestContext;
  providers: readonly SourceControlToolProvider[];
  audit: AuditAgentEmitter;
  /** Per-project switch for `source_control_publish_test_check`. The host decides the default; Factory projects default to off. */
  testChecksEnabled?: (input: { orgId: string; factoryProjectId: string }) => Promise<boolean>;
  /**
   * Self-review gate for opening a change request. `undefined` means the session
   * is not gated (no Work item, or its change request predates Self-review);
   * `null` means Self-review has not approved; a SHA is the approved head.
   */
  selfReviewApprovedHead?: () => Promise<string | null | undefined>;
  /**
   * The change request a Review-bound session reviews; test checks may only target it.
   * When provided, sessions that are not Review-bound (it resolves `undefined`) cannot publish.
   */
  boundChangeRequestId?: () => Promise<string | undefined>;
}): Promise<IntegrationTools> {
  if (!requestContext || typeof (requestContext as { get?: unknown }).get !== 'function') return {};
  const controller = requestContext.get('controller') as
    | AgentControllerRequestContext<RepositorySessionState>
    | undefined;
  const identity = authIdentity(requestContext);
  if (!controller?.sessionId || !identity.orgId || !identity.userId || providers.length === 0) return {};

  const repositoryArgument = repositoryArgumentDescription(
    await describeSessionRepositories(controller.sessionId, providers),
  );
  const withTarget = (options?: { repository?: string }) => resolveSessionTarget(requestContext, providers, options);
  const targetFor = (input: { repository?: string }) =>
    withTarget(input.repository !== undefined ? { repository: input.repository } : undefined);
  const reference = async (target: SessionTarget) => ({
    ...(await target.provider.versionControl.getRepositoryTarget({
      orgId: target.orgId,
      repositoryId: target.repository.id,
    })),
    actingUserId: target.userId,
  });

  const versionControlFor = <K extends keyof VersionControl>(target: SessionTarget, method: K) => {
    const versionControl = target.provider.versionControl;
    if (!versionControl[method]) {
      throw new Error(`${target.provider.id} repositories do not support this operation in Factory.`);
    }
    return versionControl as VersionControl & Required<Pick<VersionControl, K>>;
  };

  const verifyRerun = async (input: RerunInput) => {
    const target = await targetFor(input);
    const run = await versionControlFor(target, 'getWorkflowRun').getWorkflowRun({
      ...(await reference(target)),
      runId: input.runId,
    });
    if (!run) throw new Error(`Workflow run ${input.runId} does not exist in ${target.repository.slug}.`);
    const mismatches = [
      run.workflowName !== input.workflowName && `workflow is '${run.workflowName}'`,
      run.headBranch !== input.headBranch && `head branch is '${run.headBranch}'`,
      run.headSha !== input.headSha && `head SHA is ${run.headSha}`,
    ].filter(Boolean);
    if (mismatches.length > 0) {
      throw new Error(`Workflow run ${input.runId} does not match the request: its ${mismatches.join(', ')}.`);
    }
    if (run.headBranch !== target.session.branch) {
      throw new Error(`Only runs of this session's branch (${target.session.branch}) can be re-run.`);
    }
    if (!RERUNNABLE_EVENTS.has(run.event)) {
      throw new Error(`Runs triggered by '${run.event}' cannot be re-run from a session.`);
    }
    return { target, run };
  };

  const prepareWorkflowPush = async (input: WorkflowPushInput, workspace: unknown) => {
    const target = await targetFor(input);
    const versionControl = versionControlFor(target, 'pushCommits');
    if (!versionControl.getBranchState) {
      throw new Error(`${target.provider.id} repositories do not support this operation in Factory.`);
    }
    const sandbox = executableSandbox((workspace as { sandbox?: unknown } | undefined)?.sandbox);
    const workdir = await resolveSessionWorkdir(target.session.id, sandbox, target.repository.slug);
    if (!target.ownRepository) {
      const access = await versionControl.getRepositoryAccess({
        orgId: target.orgId,
        repositoryId: target.repository.id,
      });
      if (!(await isCheckoutOf(sandbox, workdir, access.cloneUrl))) {
        throw new Error(`There is no checkout of ${target.repository.slug} in this session.`);
      }
    }
    const branch = target.session.branch;
    const ref = await reference(target);
    const state = await versionControl.getBranchState({ ...ref, branch });
    if (branch === state.defaultBranch || state.protected) {
      throw new Error(`Refusing to push to ${branch}: it is the default or a protected branch.`);
    }
    await ensureLocalBranch(sandbox, workdir, branch);
    const exported = await exportBranchCommits(sandbox, workdir, branch, {
      fastForwardFrom: state.headSha,
      knownRemoteCommits: [state.defaultBranchSha],
    });
    if (exported.headSha !== input.headSha) {
      throw new Error(
        `${branch} is at ${exported.headSha}, not ${input.headSha}. Request approval for the current head.`,
      );
    }
    if (exported.commits.length === 0) throw new Error(`${branch} has nothing to push.`);
    const workflowFiles = changedWorkflowFiles(exported.commits);
    if (workflowFiles.length === 0) {
      throw new Error('These commits do not change .github/workflows/. Push them with source_control_push_branch.');
    }
    if (!sameFiles(workflowFiles, input.workflowFiles)) {
      throw new Error(
        `The commits change these workflow files: ${workflowFiles.join(', ')}. List exactly those in workflowFiles, each once.`,
      );
    }
    const workflowChanges = renderWorkflowChanges(exported);
    if (JSON.stringify(workflowChanges).length > MAX_WORKFLOW_CHANGES_LENGTH) {
      throw new Error(
        `The workflow changes are too large to show for approval (over ${MAX_WORKFLOW_CHANGES_LENGTH} characters). Push smaller workflow changes. Nothing was pushed.`,
      );
    }
    if (input.workflowChanges !== workflowChanges) {
      throw new Error(
        `workflowChanges does not match the commits. Pass exactly this text as workflowChanges:\n${workflowChanges}`,
      );
    }
    return { target, versionControl, sandbox, workdir, branch, ref, state, exported, workflowFiles };
  };

  return {
    source_control_list_workflow_runs: createTool({
      id: 'source_control_list_workflow_runs',
      description: `List recent GitHub Actions runs of the active session branch, newest first, with the run id, workflow name, head SHA, event, status, and conclusion needed to re-run one. ${repositoryArgument}`,
      inputSchema: repositorySchema.extend({
        headSha: z
          .string()
          .regex(/^[0-9a-f]{40}$/)
          .optional()
          .describe('Only runs of this commit.'),
      }),
      execute: async input => {
        const target = await targetFor(input);
        return {
          runs: await versionControlFor(target, 'listWorkflowRuns').listWorkflowRuns({
            ...(await reference(target)),
            branch: target.session.branch,
            ...(input.headSha ? { headSha: input.headSha } : {}),
          }),
        };
      },
    }),
    source_control_rerun_workflow_run: createTool({
      id: 'source_control_rerun_workflow_run',
      description: `Re-run a GitHub Actions run of the active session branch: only its failed jobs, or the whole run. A person must approve each call; the arguments are shown to them and must match the run exactly (get them from source_control_list_workflow_runs). Only pull_request, push, and merge_group runs of the session branch can be re-run. ${repositoryArgument}`,
      inputSchema: rerunSchema,
      requireApproval: true,
      beforeApproval: refuseBeforeApproval(input => verifyRerun(input)),
      execute: async input => {
        const { target, run } = await verifyRerun(input);
        await versionControlFor(target, 'rerunWorkflowRun').rerunWorkflowRun({
          ...(await reference(target)),
          runId: run.id,
          failedJobsOnly: input.failedJobsOnly,
        });
        await emitAgentAudit(audit, requestContext, {
          action: 'factory.agent.workflow_rerun',
          targets: [{ type: 'repository', id: target.repository.slug }],
          metadata: {
            runId: run.id,
            workflow: run.workflowName,
            branch: run.headBranch,
            headSha: run.headSha,
            failedJobsOnly: input.failedJobsOnly,
            provider: target.provider.id,
          },
        });
        return { rerun: true, runId: run.id, url: run.url, failedJobsOnly: input.failedJobsOnly };
      },
    }),
    source_control_push_workflow_changes: createTool({
      id: 'source_control_push_workflow_changes',
      description: `Push the active session branch when its unpushed commits change files under .github/workflows/, which source_control_push_branch cannot do. A person must approve each call; the arguments are shown to them. Pass the branch head SHA, exactly the workflow files the unpushed commits add, change, or delete, and their end state as workflowChanges (a call with any other value is refused and told the exact text). The commits are recreated on GitHub server-side with identical SHAs, so the branch must fast-forward the remote and commits must be unsigned. Never pushes the default or a protected branch. ${repositoryArgument}`,
      inputSchema: workflowPushSchema,
      requireApproval: true,
      beforeApproval: refuseBeforeApproval((input, workspace) => prepareWorkflowPush(input, workspace)),
      execute: async (input, { workspace }) => {
        const { target, versionControl, sandbox, workdir, branch, ref, state, exported, workflowFiles } =
          await prepareWorkflowPush(input, workspace);
        const { headSha } = await versionControl.pushCommits({
          ...ref,
          branch,
          expectedHeadSha: state.headSha,
          commits: exported.commits,
          blobs: exported.blobs,
          approvedWorkflowFiles: input.workflowFiles,
        });
        // Keep the checkout's view of the remote current; git status and later plain pushes rely on it.
        await sandbox
          .executeCommand('git', ['-C', workdir, 'update-ref', `refs/remotes/origin/${branch}`, headSha])
          .catch(() => undefined);
        await target.provider.storage.sessionRepositories.upsert({
          sessionId: target.session.sessionId,
          projectRepositoryId: target.projectRepository.id,
          branch,
        });
        updateSessionEnvironmentRepository(target.session.sessionId, target.repository.slug, { branch });
        await emitAgentAudit(audit, requestContext, {
          action: 'factory.agent.push',
          targets: [{ type: 'repository', id: target.repository.slug }],
          metadata: {
            branch,
            provider: target.provider.id,
            repository: target.repository.slug,
            headSha,
            workflowFiles,
          },
        });
        return { pushed: true, branch, repository: target.repository.slug, headSha, workflowFiles };
      },
    }),
    source_control_refresh_change_request_checkout: createTool({
      id: 'source_control_refresh_change_request_checkout',
      description:
        'Refresh the active GitLab review session checkout to its current MR head. The MR, repository, branch, and credential are resolved server-side; no provider credentials enter the agent workspace.',
      inputSchema: z.object({}),
      execute: async (_input, { workspace }) => {
        const target = await withTarget();
        const mergeRequestNumber = mergeRequestNumberFromBranch(target.session.branch);
        if (target.provider.id !== 'gitlab' || mergeRequestNumber === undefined) {
          throw new Error('Checkout refresh is only available in a bound GitLab merge-request review session.');
        }
        const ref = await reference(target);
        const mergeRequest = await target.provider.versionControl.getPullRequest({
          ...ref,
          pullRequestId: String(mergeRequestNumber),
        });
        if (!mergeRequest || mergeRequest.state !== 'open' || mergeRequest.merged) {
          throw new Error('The bound GitLab merge request is no longer open.');
        }
        const sandbox = executableSandbox(workspace?.sandbox);
        const workdir = await resolveSessionWorkdir(target.session.id, sandbox, target.repository.slug);
        const access = await target.provider.versionControl.getRepositoryAccess({
          orgId: target.orgId,
          repositoryId: target.repository.id,
        });
        const result = await refreshMergeRequestCheckout(sandbox, workdir, {
          branch: target.session.branch,
          mergeRequestNumber,
          expectedHeadSha: mergeRequest.headSha,
          access,
        });
        return result;
      },
    }),
    source_control_push_branch: createTool({
      id: 'source_control_push_branch',
      description: `Push the active Factory session branch to its connected source-control provider. Credentials are resolved and scrubbed server-side; this tool takes no token, remote, or branch arguments. ${repositoryArgument}`,
      inputSchema: repositorySchema,
      execute: async (input, { workspace }) => {
        const target = await targetFor(input);
        const sandbox = executableSandbox(workspace?.sandbox);
        const workdir = await resolveSessionWorkdir(target.session.id, sandbox, target.repository.slug);
        const access = await target.provider.versionControl.getRepositoryAccess({
          orgId: target.orgId,
          repositoryId: target.repository.id,
        });
        // Another environment repository's directory may not be its checkout:
        // a boot skips a link whose directory name collides with another's, and
        // a session that booted single-repository has no siblings at all.
        if (!target.ownRepository && !(await isCheckoutOf(sandbox, workdir, access.cloneUrl))) {
          throw new Error(`There is no checkout of ${target.repository.slug} in this session.`);
        }
        const branch = target.session.branch;
        // Materialize the session branch at the active HEAD without discarding
        // session-only commits, so the push includes the agent's current work.
        await ensureLocalBranch(sandbox, workdir, branch);
        try {
          await pushRepositoryBranch(sandbox, workdir, branch, access, target.repository.slug);
        } catch (error) {
          if (error instanceof Error && WORKFLOW_PUSH_REFUSAL.test(error.message)) {
            throw new Error(
              `${error.message}\nThe session credential cannot change .github/workflows/. Push this branch with source_control_push_workflow_changes, which asks a person to approve the workflow changes.`,
            );
          }
          throw error;
        }
        await target.provider.storage.sessionRepositories.upsert({
          sessionId: target.session.sessionId,
          projectRepositoryId: target.projectRepository.id,
          branch,
        });
        updateSessionEnvironmentRepository(target.session.sessionId, target.repository.slug, { branch });
        await emitAgentAudit(audit, requestContext, {
          action: 'factory.agent.push',
          targets: [{ type: 'repository', id: target.repository.slug }],
          metadata: { branch, provider: target.provider.id, repository: target.repository.slug },
        });
        return { pushed: true, branch, repository: target.repository.slug };
      },
    }),
    source_control_get_change_request: createTool({
      id: 'source_control_get_change_request',
      description: `Read a pull request or merge request in the active Factory repository by its numeric repository-local ID. ${repositoryArgument}`,
      inputSchema: changeRequestSchema,
      execute: async input => {
        const target = await targetFor(input);
        return target.provider.versionControl.getPullRequest({
          ...(await reference(target)),
          pullRequestId: changeRequestId(input.changeRequestId),
        });
      },
    }),
    source_control_list_change_request_reviews: createTool({
      id: 'source_control_list_change_request_reviews',
      description: `List submitted reviews and approvals on a pull request or merge request in the active repository. ${repositoryArgument}`,
      inputSchema: changeRequestSchema.extend({ cursor: z.string().trim().min(1).optional() }),
      execute: async input => {
        const target = await targetFor(input);
        return target.provider.versionControl.listReviews({
          ...(await reference(target)),
          pullRequestId: changeRequestId(input.changeRequestId),
          ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
        });
      },
    }),
    source_control_create_change_request: createTool({
      id: 'source_control_create_change_request',
      description: `Open a pull request or merge request from the active Factory session branch into the repository's base branch (the session's persisted base branch in its own repository, the linked or default branch elsewhere). Push the branch with source_control_push_branch first. ${repositoryArgument}`,
      inputSchema: repositorySchema.extend({
        title: z.string().trim().min(1),
        body: z.string().optional(),
        draft: z.boolean().optional(),
      }),
      execute: async (input, execution) => {
        const target = await targetFor(input);
        const approvedHead = target.ownRepository ? await selfReviewApprovedHead?.() : undefined;
        if (approvedHead === null) {
          throw new Error(
            'Self-review has not approved this branch. Move the work item to Self-review; the change request opens after it approves.',
          );
        }
        const baseBranch = target.ownRepository
          ? target.session.baseBranch
          : (target.projectRepository.branch ?? target.repository.defaultBranch);
        const created = await target.provider.versionControl.createPullRequest({
          ...(await reference(target)),
          title: input.title,
          ...(input.body !== undefined ? { body: input.body } : {}),
          baseBranch,
          headBranch: target.session.branch,
          ...(input.draft !== undefined ? { draft: input.draft } : {}),
        });
        if (approvedHead !== undefined && created.headSha.toLowerCase() !== approvedHead.toLowerCase()) {
          await target.provider.versionControl.closePullRequest({
            ...(await reference(target)),
            pullRequestId: created.id,
          });
          throw new Error(
            `Self-review approved ${approvedHead}, but the pushed branch is at ${created.headSha}; the change request was closed. Push the approved head, or move the work item back to Self-review to review the new commits.`,
          );
        }
        await target.provider.storage.sessionRepositories.upsert({
          sessionId: target.session.sessionId,
          projectRepositoryId: target.projectRepository.id,
          // Opening a change request pushes nothing: an existing row keeps its
          // `pushedAt`; the branch only seeds a row no push wrote yet.
          fallbackBranch: target.session.branch,
          changeRequestId: changeRequestId(created.id),
          changeRequestUrl: created.url,
        });
        updateSessionEnvironmentRepository(target.session.sessionId, target.repository.slug, {
          changeRequestUrl: created.url,
        });
        await emitAgentAudit(audit, requestContext, {
          action: 'factory.agent.pr_opened',
          targets: [
            { type: 'pull_request', id: created.url },
            { type: 'repository', id: target.repository.slug },
          ],
          metadata: { url: created.url, provider: target.provider.id, repository: target.repository.slug },
        });
        return created;
      },
    }),
    source_control_update_change_request: createTool({
      id: 'source_control_update_change_request',
      description: `Update the title, body, target branch, or open/closed state of a change request. ${repositoryArgument}`,
      inputSchema: changeRequestSchema.extend({
        title: z.string().trim().min(1).optional(),
        body: z.string().nullable().optional(),
        baseBranch: z.string().trim().min(1).optional(),
        state: z.enum(['open', 'closed']).optional(),
      }),
      execute: async input => {
        const target = await targetFor(input);
        return target.provider.versionControl.updatePullRequest({
          ...(await reference(target)),
          pullRequestId: changeRequestId(input.changeRequestId),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(input.baseBranch !== undefined ? { baseBranch: input.baseBranch } : {}),
          ...(input.state !== undefined ? { state: input.state } : {}),
        });
      },
    }),
    source_control_comment_change_request: createTool({
      id: 'source_control_comment_change_request',
      description: `Add a top-level comment to a pull request or merge request in the active repository. ${repositoryArgument}`,
      inputSchema: changeRequestSchema.extend({ body: z.string().trim().min(1) }),
      execute: async input => {
        const target = await targetFor(input);
        return target.provider.versionControl.createComment({
          ...(await reference(target)),
          pullRequestId: changeRequestId(input.changeRequestId),
          body: input.body,
        });
      },
    }),
    source_control_list_change_request_comments: createTool({
      id: 'source_control_list_change_request_comments',
      description: `List top-level comments on a pull request or merge request in the active repository. ${repositoryArgument}`,
      inputSchema: changeRequestSchema.extend({ cursor: z.string().trim().min(1).optional() }),
      execute: async input => {
        const target = await targetFor(input);
        return target.provider.versionControl.listComments({
          ...(await reference(target)),
          pullRequestId: changeRequestId(input.changeRequestId),
          ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
        });
      },
    }),
    source_control_update_change_request_comment: createTool({
      id: 'source_control_update_change_request_comment',
      description: `Edit a top-level pull-request or merge-request comment in the active repository. ${repositoryArgument}`,
      inputSchema: repositorySchema.extend({ commentId: z.string().trim().min(1), body: z.string().trim().min(1) }),
      execute: async input => {
        const target = await targetFor(input);
        return target.provider.versionControl.updateComment({
          ...(await reference(target)),
          commentId: input.commentId,
          body: input.body,
        });
      },
    }),
    source_control_delete_change_request_comment: createTool({
      id: 'source_control_delete_change_request_comment',
      description: `Delete a top-level pull-request or merge-request comment in the active repository. ${repositoryArgument}`,
      inputSchema: repositorySchema.extend({ commentId: z.string().trim().min(1) }),
      execute: async input => {
        const target = await targetFor(input);
        await target.provider.versionControl.deleteComment({
          ...(await reference(target)),
          commentId: input.commentId,
        });
        return { deleted: true };
      },
    }),
    source_control_list_diff_comments: createTool({
      id: 'source_control_list_diff_comments',
      description: `List line-anchored review comments and discussion replies on a pull request or merge request in the active repository. ${repositoryArgument}`,
      inputSchema: changeRequestSchema.extend({ cursor: z.string().trim().min(1).optional() }),
      execute: async input => {
        const target = await targetFor(input);
        return target.provider.versionControl.listReviewComments({
          ...(await reference(target)),
          pullRequestId: changeRequestId(input.changeRequestId),
          ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
        });
      },
    }),
    source_control_create_diff_comment: createTool({
      id: 'source_control_create_diff_comment',
      description: `Create a line-anchored review comment or reply to an existing diff discussion. Use replyToId alone for a reply; otherwise provide commitId, path, line, and side. ${repositoryArgument}`,
      // A root-level union is not representable as provider function parameters, which must be
      // an object schema, so both modes share one object shape and a refinement.
      inputSchema: changeRequestSchema
        .extend({
          body: z.string().trim().min(1),
          replyToId: z.string().trim().min(1).optional(),
          commitId: z.string().trim().min(1).optional(),
          path: z.string().trim().min(1).optional(),
          line: z.number().int().positive().optional(),
          side: z.enum(['left', 'right']).optional(),
          startLine: z.number().int().positive().optional(),
          startSide: z.enum(['left', 'right']).optional(),
        })
        .refine(
          input => {
            const anchorFields = [input.commitId, input.path, input.line, input.side];
            const anchor = anchorFields.every(field => field !== undefined);
            const reply = input.replyToId !== undefined;
            return (
              (reply ? anchorFields.every(field => field === undefined) : anchor) &&
              (input.startLine === undefined) === (input.startSide === undefined)
            );
          },
          {
            message:
              'Provide replyToId alone to reply to a diff thread, or commitId, path, line, and side to start one. startLine and startSide must be provided together.',
          },
        ),
      execute: async input => {
        const target = await targetFor(input);
        const base = {
          ...(await reference(target)),
          pullRequestId: changeRequestId(input.changeRequestId),
          body: input.body,
        };
        if (input.replyToId !== undefined) {
          return target.provider.versionControl.createReviewComment({ ...base, replyToId: input.replyToId });
        }
        if (
          input.commitId === undefined ||
          input.path === undefined ||
          input.line === undefined ||
          input.side === undefined
        ) {
          throw new Error('commitId, path, line, and side are required to start a new diff thread.');
        }
        return target.provider.versionControl.createReviewComment({
          ...base,
          commitId: input.commitId,
          path: input.path,
          line: input.line,
          side: input.side,
          ...(input.startLine !== undefined && input.startSide !== undefined
            ? { startLine: input.startLine, startSide: input.startSide }
            : {}),
        });
      },
    }),
    source_control_update_diff_comment: createTool({
      id: 'source_control_update_diff_comment',
      description: `Edit a line-anchored review comment or discussion reply in the active repository. ${repositoryArgument}`,
      inputSchema: repositorySchema.extend({ commentId: z.string().trim().min(1), body: z.string().trim().min(1) }),
      execute: async input => {
        const target = await targetFor(input);
        return target.provider.versionControl.updateReviewComment({
          ...(await reference(target)),
          commentId: input.commentId,
          body: input.body,
        });
      },
    }),
    source_control_delete_diff_comment: createTool({
      id: 'source_control_delete_diff_comment',
      description: `Delete a line-anchored review comment or discussion reply in the active repository. ${repositoryArgument}`,
      inputSchema: repositorySchema.extend({ commentId: z.string().trim().min(1) }),
      execute: async input => {
        const target = await targetFor(input);
        await target.provider.versionControl.deleteReviewComment({
          ...(await reference(target)),
          commentId: input.commentId,
        });
        return { deleted: true };
      },
    }),
    source_control_resolve_diff_thread: createTool({
      id: 'source_control_resolve_diff_thread',
      description: `Resolve or reopen the review thread containing a diff comment. Providers without resolvable threads return an explicit limitation. ${repositoryArgument}`,
      inputSchema: repositorySchema.extend({
        commentId: z.string().trim().min(1),
        resolved: z.boolean().default(true),
      }),
      execute: async input => {
        const target = await targetFor(input);
        const resolveReviewThread = target.provider.versionControl.resolveReviewThread;
        if (!resolveReviewThread) {
          throw new Error(`${target.provider.id} does not support resolving review threads.`);
        }
        await resolveReviewThread({
          ...(await reference(target)),
          commentId: input.commentId,
          resolved: input.resolved,
        });
        return { resolved: input.resolved };
      },
    }),
    source_control_review_change_request: createTool({
      id: 'source_control_review_change_request',
      description: `Submit an approve, request-changes, or comment review to a change request. Provider limitations are returned explicitly. ${repositoryArgument}`,
      inputSchema: changeRequestSchema
        .extend({
          event: z.enum(['approve', 'request-changes', 'comment']),
          body: z.string().optional(),
          commitId: z.string().trim().min(1).optional(),
        })
        .refine(input => input.event === 'approve' || Boolean(input.body?.trim()), {
          path: ['body'],
          message: 'request-changes and comment reviews require a body.',
        })
        .superRefine((input, ctx) => {
          const mismatch = verdictEventMismatch(input.event, input.body);
          if (mismatch) ctx.addIssue({ code: 'custom', path: ['body'], message: mismatch });
          const reviewedHead = reviewedHeadFromBody(input.body);
          if (reviewedHead === null) {
            ctx.addIssue({
              code: 'custom',
              path: ['body'],
              message: 'Every "Reviewed head:" line must name the same full 40- or 64-character commit SHA.',
            });
          } else if (reviewedHead && input.commitId && input.commitId.toLowerCase() !== reviewedHead) {
            ctx.addIssue({
              code: 'custom',
              path: ['commitId'],
              message: `Review body says "Reviewed head: ${reviewedHead}" but commitId is ${input.commitId}. Nothing was posted. Re-review the current head and regenerate the body before publishing.`,
            });
          }
        }),
      execute: async input => {
        const target = await targetFor(input);
        const reviewedHead = reviewedHeadFromBody(input.body);
        if (reviewedHead) {
          const pullRequest = await target.provider.versionControl.getPullRequest({
            ...(await reference(target)),
            pullRequestId: changeRequestId(input.changeRequestId),
          });
          if (!pullRequest) {
            throw new Error(`Change request ${input.changeRequestId} was not found; nothing was posted.`);
          }
          if (pullRequest.headSha && pullRequest.headSha.toLowerCase() !== reviewedHead) {
            throw new Error(
              `Review body says "Reviewed head: ${reviewedHead}" but the current change-request head is ${pullRequest.headSha}. Nothing was posted. Re-review the current head and regenerate the body before publishing.`,
            );
          }
        }
        const base = {
          ...(await reference(target)),
          pullRequestId: changeRequestId(input.changeRequestId),
          ...(input.commitId !== undefined
            ? { commitId: input.commitId }
            : reviewedHead
              ? { commitId: reviewedHead }
              : {}),
        };
        if (input.event === 'approve') {
          return target.provider.versionControl.createReview({
            ...base,
            event: 'approve',
            ...(input.body !== undefined ? { body: input.body } : {}),
          });
        }
        return target.provider.versionControl.createReview({ ...base, event: input.event, body: input.body! });
      },
    }),
    source_control_publish_test_check: createTool({
      id: 'source_control_publish_test_check',
      description: `Publish the Factory review test result as a "${FACTORY_TEST_CHECK_NAME}" commit check on the change request's current head. Publish "in-progress" before running the test plan and a final status after. Refused when headSha is not the current head. ${repositoryArgument}`,
      inputSchema: changeRequestSchema.extend({
        headSha: z
          .string()
          .trim()
          .regex(/^([0-9a-f]{40}|[0-9a-f]{64})$/i, 'headSha must be a full 40- or 64-character commit SHA.'),
        status: z.enum(['in-progress', 'success', 'failure', 'neutral', 'cancelled', 'skipped']),
        title: z.string().trim().min(1),
        summary: z.string().trim().min(1),
        details: z.string().optional(),
      }),
      execute: async input => {
        const target = await targetFor(input);
        if (testChecksEnabled) {
          const connection = await target.provider.storage.connections.get({
            orgId: target.orgId,
            id: target.projectRepository.connectionId,
          });
          if (
            connection?.factoryProjectId &&
            !(await testChecksEnabled({ orgId: target.orgId, factoryProjectId: connection.factoryProjectId }))
          ) {
            throw new Error(
              'Test check publishing is turned off for this Factory project; nothing was published. Report the test results in the test report comment instead.',
            );
          }
        }
        const publishCommitCheck = target.provider.versionControl.publishCommitCheck;
        if (!publishCommitCheck) {
          throw new Error(`${target.provider.id} does not support publishing commit checks; nothing was published.`);
        }
        const bound = boundChangeRequestId ? await boundChangeRequestId() : undefined;
        if (bound === undefined) {
          throw new Error(
            'Only a Review session bound to this change request can publish test checks; nothing was published.',
          );
        }
        if (bound !== changeRequestId(input.changeRequestId)) {
          throw new Error(
            `This session reviews change request ${bound}, not ${input.changeRequestId}; nothing was published.`,
          );
        }
        const ref = await reference(target);
        const pullRequest = await target.provider.versionControl.getPullRequest({
          ...ref,
          pullRequestId: changeRequestId(input.changeRequestId),
        });
        if (!pullRequest || pullRequest.state !== 'open') {
          throw new Error(`Change request ${input.changeRequestId} is not open; nothing was published.`);
        }
        const headSha = input.headSha.toLowerCase();
        if (pullRequest.headSha.toLowerCase() !== headSha) {
          throw new Error(
            `headSha ${headSha} is not the current change-request head ${pullRequest.headSha}. Nothing was published. Re-run the test plan on the current head.`,
          );
        }
        return publishCommitCheck({
          connection: ref.connection,
          sourceId: ref.sourceId,
          actingUserId: ref.actingUserId,
          headSha,
          ref: pullRequest.headBranch,
          name: FACTORY_TEST_CHECK_NAME,
          status: input.status,
          title: input.title,
          summary: input.summary,
          ...(input.details !== undefined ? { details: input.details } : {}),
        });
      },
    }),
    source_control_request_reviewers: createTool({
      id: 'source_control_request_reviewers',
      description: `Request individual or team reviewers on a pull request or merge request. Provider limitations are returned explicitly. ${repositoryArgument}`,
      inputSchema: changeRequestSchema.extend({
        users: z.array(z.string().trim().min(1)).default([]),
        teams: z.array(z.string().trim().min(1)).default([]),
      }),
      execute: async input => {
        const target = await targetFor(input);
        return target.provider.versionControl.requestReviewers({
          ...(await reference(target)),
          pullRequestId: changeRequestId(input.changeRequestId),
          users: input.users,
          teams: input.teams,
        });
      },
    }),
    source_control_merge_change_request: createTool({
      id: 'source_control_merge_change_request',
      description: `Merge a pull request or merge request using the requested provider-supported merge method. ${repositoryArgument}`,
      inputSchema: changeRequestSchema.extend({
        method: z.enum(['merge', 'squash', 'rebase']).optional(),
        commitTitle: z.string().optional(),
        commitMessage: z.string().optional(),
      }),
      execute: async input => {
        const target = await targetFor(input);
        return target.provider.versionControl.mergePullRequest({
          ...(await reference(target)),
          pullRequestId: changeRequestId(input.changeRequestId),
          ...(input.method !== undefined ? { method: input.method } : {}),
          ...(input.commitTitle !== undefined ? { commitTitle: input.commitTitle } : {}),
          ...(input.commitMessage !== undefined ? { commitMessage: input.commitMessage } : {}),
        });
      },
    }),
  };
}

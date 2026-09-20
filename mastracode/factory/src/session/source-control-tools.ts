import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { z } from 'zod';

import { getFactoryAuthOrgId, getFactoryAuthUserFromContext, getFactoryAuthUserId } from '../auth.js';
import type { VersionControl } from '../capabilities/version-control.js';
import type { IntegrationTools } from '../integrations/base.js';
import { pushRepositoryBranch } from '../integrations/github/sandbox.js';
import type { ExecutableSandbox } from '../sandbox/materialization.js';
import { resolveSessionWorkdir } from '../sandbox/session-sandbox.js';
import type { AuditAgentEmitter } from '../storage/domains/audit/domain.js';
import type {
  ProjectRepository,
  SourceControlRepository,
  SourceControlSession,
  SourceControlStorageHandle,
} from '../storage/domains/source-control/base.js';

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
}

function authIdentity(requestContext: RequestContext) {
  const user = getFactoryAuthUserFromContext(requestContext);
  return { orgId: getFactoryAuthOrgId(user), userId: getFactoryAuthUserId(user) };
}

async function resolveSessionTarget(
  requestContext: RequestContext,
  providers: readonly SourceControlToolProvider[],
): Promise<SessionTarget> {
  const context = requestContext.get('controller') as AgentControllerRequestContext<RepositorySessionState> | undefined;
  const { orgId, userId } = authIdentity(requestContext);
  if (!context?.resourceId || !orgId || !userId) {
    throw new Error('Source-control tools require an authenticated repository session.');
  }

  const matches = (
    await Promise.all(
      providers.map(async provider => ({
        provider,
        session: await provider.storage.sessions.getBySessionId(context.resourceId),
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

  const { provider, session } = matches[0]!;
  if (session.orgId !== orgId || (session.visibility === 'private' && session.userId !== userId)) {
    throw new Error('The active source-control session is not available to the authenticated user.');
  }
  const projectRepository = await provider.storage.projectRepositories.get({
    orgId,
    id: session.projectRepositoryId,
  });
  if (!projectRepository) throw new Error('The active project repository was not found.');
  const state = context.getState();
  if (state.projectRepositoryId && state.projectRepositoryId !== projectRepository.id) {
    throw new Error('The active source-control session does not match its controller repository.');
  }
  const connection = await provider.storage.connections.get({ orgId, id: projectRepository.connectionId });
  if (!connection) throw new Error('The active source-control connection was not found.');
  if (state.factoryProjectId && state.factoryProjectId !== connection.factoryProjectId) {
    throw new Error('The active source-control session does not match its Factory project.');
  }
  const repository = await provider.storage.repositories.get({ orgId, id: projectRepository.repositoryId });
  if (!repository) throw new Error('The active source-control repository was not found.');
  return { context, provider, session, projectRepository, repository, orgId, userId };
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

const changeRequestSchema = z.object({
  changeRequestId: z.union([z.string().trim().min(1), z.number().int().positive()]),
});

export function createSourceControlTools({
  requestContext,
  providers,
  audit,
}: {
  requestContext: RequestContext;
  providers: readonly SourceControlToolProvider[];
  audit: AuditAgentEmitter;
}): IntegrationTools {
  if (!requestContext || typeof (requestContext as { get?: unknown }).get !== 'function') return {};
  const controller = requestContext.get('controller') as
    | AgentControllerRequestContext<RepositorySessionState>
    | undefined;
  const identity = authIdentity(requestContext);
  if (!controller?.resourceId || !identity.orgId || !identity.userId || providers.length === 0) return {};

  const withTarget = () => resolveSessionTarget(requestContext, providers);
  const reference = async (target: SessionTarget) => ({
    ...(await target.provider.versionControl.getRepositoryTarget({
      orgId: target.orgId,
      repositoryId: target.repository.id,
    })),
    actingUserId: target.userId,
  });

  return {
    source_control_push_branch: createTool({
      id: 'source_control_push_branch',
      description:
        'Push the active Factory session branch to its connected source-control provider. Credentials are resolved and scrubbed server-side; this tool takes no token, repository, remote, or branch arguments.',
      inputSchema: z.object({}),
      execute: async (_input, { workspace }) => {
        const target = await withTarget();
        const sandbox = executableSandbox(workspace?.sandbox);
        const workdir = await resolveSessionWorkdir(target.session.id, sandbox, target.repository.slug);
        const access = await target.provider.versionControl.getRepositoryAccess({
          orgId: target.orgId,
          repositoryId: target.repository.id,
        });
        await pushRepositoryBranch(sandbox, workdir, target.session.branch, access, target.repository.slug);
        await emitAgentAudit(audit, requestContext, {
          action: 'factory.agent.push',
          targets: [{ type: 'repository', id: target.repository.slug }],
          metadata: { branch: target.session.branch, provider: target.provider.id },
        });
        return { pushed: true, branch: target.session.branch, repository: target.repository.slug };
      },
    }),
    source_control_get_change_request: createTool({
      id: 'source_control_get_change_request',
      description:
        'Read a pull request or merge request in the active Factory repository by its numeric repository-local ID.',
      inputSchema: changeRequestSchema,
      execute: async input => {
        const target = await withTarget();
        return target.provider.versionControl.getPullRequest({
          ...(await reference(target)),
          pullRequestId: changeRequestId(input.changeRequestId),
        });
      },
    }),
    source_control_list_change_request_reviews: createTool({
      id: 'source_control_list_change_request_reviews',
      description: 'List submitted reviews and approvals on a pull request or merge request in the active repository.',
      inputSchema: changeRequestSchema.extend({ cursor: z.string().trim().min(1).optional() }),
      execute: async input => {
        const target = await withTarget();
        return target.provider.versionControl.listReviews({
          ...(await reference(target)),
          pullRequestId: changeRequestId(input.changeRequestId),
          ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
        });
      },
    }),
    source_control_create_change_request: createTool({
      id: 'source_control_create_change_request',
      description:
        'Open a pull request or merge request from the active Factory session branch into its persisted base branch. Push the branch with source_control_push_branch first.',
      inputSchema: z.object({
        title: z.string().trim().min(1),
        body: z.string().optional(),
        draft: z.boolean().optional(),
      }),
      execute: async input => {
        const target = await withTarget();
        const created = await target.provider.versionControl.createPullRequest({
          ...(await reference(target)),
          title: input.title,
          ...(input.body !== undefined ? { body: input.body } : {}),
          baseBranch: target.session.baseBranch,
          headBranch: target.session.branch,
          ...(input.draft !== undefined ? { draft: input.draft } : {}),
        });
        await emitAgentAudit(audit, requestContext, {
          action: 'factory.agent.pr_opened',
          targets: [
            { type: 'pull_request', id: created.url },
            { type: 'repository', id: target.repository.slug },
          ],
          metadata: { url: created.url, provider: target.provider.id },
        });
        return created;
      },
    }),
    source_control_update_change_request: createTool({
      id: 'source_control_update_change_request',
      description: 'Update the title, body, target branch, or open/closed state of a change request.',
      inputSchema: changeRequestSchema.extend({
        title: z.string().trim().min(1).optional(),
        body: z.string().nullable().optional(),
        baseBranch: z.string().trim().min(1).optional(),
        state: z.enum(['open', 'closed']).optional(),
      }),
      execute: async input => {
        const target = await withTarget();
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
      description: 'Add a top-level comment to a pull request or merge request in the active repository.',
      inputSchema: changeRequestSchema.extend({ body: z.string().trim().min(1) }),
      execute: async input => {
        const target = await withTarget();
        return target.provider.versionControl.createComment({
          ...(await reference(target)),
          pullRequestId: changeRequestId(input.changeRequestId),
          body: input.body,
        });
      },
    }),
    source_control_list_change_request_comments: createTool({
      id: 'source_control_list_change_request_comments',
      description: 'List top-level comments on a pull request or merge request in the active repository.',
      inputSchema: changeRequestSchema.extend({ cursor: z.string().trim().min(1).optional() }),
      execute: async input => {
        const target = await withTarget();
        return target.provider.versionControl.listComments({
          ...(await reference(target)),
          pullRequestId: changeRequestId(input.changeRequestId),
          ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
        });
      },
    }),
    source_control_update_change_request_comment: createTool({
      id: 'source_control_update_change_request_comment',
      description: 'Edit a top-level pull-request or merge-request comment in the active repository.',
      inputSchema: z.object({ commentId: z.string().trim().min(1), body: z.string().trim().min(1) }),
      execute: async input => {
        const target = await withTarget();
        return target.provider.versionControl.updateComment({
          ...(await reference(target)),
          commentId: input.commentId,
          body: input.body,
        });
      },
    }),
    source_control_delete_change_request_comment: createTool({
      id: 'source_control_delete_change_request_comment',
      description: 'Delete a top-level pull-request or merge-request comment in the active repository.',
      inputSchema: z.object({ commentId: z.string().trim().min(1) }),
      execute: async input => {
        const target = await withTarget();
        await target.provider.versionControl.deleteComment({
          ...(await reference(target)),
          commentId: input.commentId,
        });
        return { deleted: true };
      },
    }),
    source_control_list_diff_comments: createTool({
      id: 'source_control_list_diff_comments',
      description:
        'List line-anchored review comments and discussion replies on a pull request or merge request in the active repository.',
      inputSchema: changeRequestSchema.extend({ cursor: z.string().trim().min(1).optional() }),
      execute: async input => {
        const target = await withTarget();
        return target.provider.versionControl.listReviewComments({
          ...(await reference(target)),
          pullRequestId: changeRequestId(input.changeRequestId),
          ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
        });
      },
    }),
    source_control_create_diff_comment: createTool({
      id: 'source_control_create_diff_comment',
      description:
        'Create a line-anchored review comment or reply to an existing diff discussion. Use replyToId alone for a reply; otherwise provide commitId, path, line, and side.',
      inputSchema: z.union([
        changeRequestSchema.extend({
          body: z.string().trim().min(1),
          replyToId: z.string().trim().min(1),
        }),
        changeRequestSchema
          .extend({
            body: z.string().trim().min(1),
            commitId: z.string().trim().min(1),
            path: z.string().trim().min(1),
            line: z.number().int().positive(),
            side: z.enum(['left', 'right']),
            startLine: z.number().int().positive().optional(),
            startSide: z.enum(['left', 'right']).optional(),
          })
          .refine(input => (input.startLine === undefined) === (input.startSide === undefined), {
            message: 'startLine and startSide must be provided together.',
          }),
      ]),
      execute: async input => {
        const target = await withTarget();
        const base = {
          ...(await reference(target)),
          pullRequestId: changeRequestId(input.changeRequestId),
          body: input.body,
        };
        if ('replyToId' in input) {
          return target.provider.versionControl.createReviewComment({ ...base, replyToId: input.replyToId });
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
      description: 'Edit a line-anchored review comment or discussion reply in the active repository.',
      inputSchema: z.object({ commentId: z.string().trim().min(1), body: z.string().trim().min(1) }),
      execute: async input => {
        const target = await withTarget();
        return target.provider.versionControl.updateReviewComment({
          ...(await reference(target)),
          commentId: input.commentId,
          body: input.body,
        });
      },
    }),
    source_control_delete_diff_comment: createTool({
      id: 'source_control_delete_diff_comment',
      description: 'Delete a line-anchored review comment or discussion reply in the active repository.',
      inputSchema: z.object({ commentId: z.string().trim().min(1) }),
      execute: async input => {
        const target = await withTarget();
        await target.provider.versionControl.deleteReviewComment({
          ...(await reference(target)),
          commentId: input.commentId,
        });
        return { deleted: true };
      },
    }),
    source_control_resolve_diff_thread: createTool({
      id: 'source_control_resolve_diff_thread',
      description:
        'Resolve or reopen the review thread containing a diff comment. Providers without resolvable threads return an explicit limitation.',
      inputSchema: z.object({
        commentId: z.string().trim().min(1),
        resolved: z.boolean().default(true),
      }),
      execute: async input => {
        const target = await withTarget();
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
      description:
        'Submit an approve, request-changes, or comment review to a change request. Provider limitations are returned explicitly.',
      inputSchema: changeRequestSchema
        .extend({
          event: z.enum(['approve', 'request-changes', 'comment']),
          body: z.string().optional(),
          commitId: z.string().trim().min(1).optional(),
        })
        .refine(input => input.event === 'approve' || Boolean(input.body?.trim()), {
          path: ['body'],
          message: 'request-changes and comment reviews require a body.',
        }),
      execute: async input => {
        const target = await withTarget();
        const base = {
          ...(await reference(target)),
          pullRequestId: changeRequestId(input.changeRequestId),
          ...(input.commitId !== undefined ? { commitId: input.commitId } : {}),
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
    source_control_request_reviewers: createTool({
      id: 'source_control_request_reviewers',
      description:
        'Request individual or team reviewers on a pull request or merge request. Provider limitations are returned explicitly.',
      inputSchema: changeRequestSchema.extend({
        users: z.array(z.string().trim().min(1)).default([]),
        teams: z.array(z.string().trim().min(1)).default([]),
      }),
      execute: async input => {
        const target = await withTarget();
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
      description: 'Merge a pull request or merge request using the requested provider-supported merge method.',
      inputSchema: changeRequestSchema.extend({
        method: z.enum(['merge', 'squash', 'rebase']).optional(),
        commitTitle: z.string().optional(),
        commitMessage: z.string().optional(),
      }),
      execute: async input => {
        const target = await withTarget();
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

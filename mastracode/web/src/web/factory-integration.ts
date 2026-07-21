/**
 * `FactoryIntegration` — the common contract for pluggable web integrations
 * (GitHub, Linear, third-party).
 *
 * Each integration is a self-contained class: the deploy entry
 * (`src/mastra/index.ts`) reads that integration's env vars ONCE, constructs
 * an instance with explicit credentials, and passes it to `MastraFactory`
 * via `integrations: [...]`. The factory registers the pieces each instance
 * provides — HTTP routes, agent/session tools, diagnostics — into the system.
 * No system code reads integration env vars or imports integration free
 * functions; everything downstream talks to instances through this interface.
 *
 * An absent integration means: its routes never mount, its tools never
 * register, diagnostics report "not configured", and the server boots fine.
 * Third parties add capabilities by implementing this same interface — no
 * factory changes required (the same capability-based philosophy as the
 * sandbox machine's `derive()` gate).
 */

import type { MastraCodeConfig, MountedMastraCode } from '@mastra/code-sdk';
import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import type { MastraWorker } from '@mastra/core/worker';

import type { StateSigner } from './state-signing.js';
import type { IntegrationStorageHandle } from './storage/domains/integrations/base.js';
import type { SourceControlStorageHandle } from './storage/domains/source-control/base.js';

/**
 * Input for the system's issue-triage hook: a webhook (or manual Intake
 * action) asks the system to spin up a triage session for an issue. The
 * system side (web-surface) implements the hook; integrations invoke it.
 */
export interface IssueTriageRunInput {
  repository: string;
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
  labels: string[];
  sender?: string;
  installationId: number;
  /** Active Factory resource id used by chat thread queries; projectPath remains the worktree scope. */
  resourceId?: string;
  projectPath?: string;
  branch?: string;
}

export interface IssueTriageRunResult {
  threadId?: string;
  projectPath?: string;
  branch?: string;
}

/** System hooks integrations may invoke (e.g. GitHub webhook → issue triage). */
export interface IntegrationHooks {
  runIssueTriage?: (input: IssueTriageRunInput) => Promise<IssueTriageRunResult>;
}

/**
 * Tool records integrations contribute — the same static-record shape the
 * SDK's `extraTools` accepts, so the factory can merge every integration's
 * tools into one dynamic tool set.
 */
export type IntegrationTools = Extract<NonNullable<MastraCodeConfig['extraTools']>, Record<string, unknown>>;

/**
 * Everything the factory hands an integration when collecting its routes.
 * Built once per boot in `MastraFactory.prepare()`.
 */
export interface IntegrationContext {
  /** Browser-facing origin (OAuth redirect base), no trailing slash. */
  baseUrl?: string;
  /** Mounted agent controller for webhook → session signal delivery. */
  controller?: MountedMastraCode['controller'];
  /**
   * Shared OAuth state signer created by the factory. One signer per boot, so
   * every integration's OAuth flow signs and verifies with the same secret.
   */
  stateSigner: StateSigner;
  /** Persistence handles pre-scoped to this integration's stable id. */
  storage: {
    generic: IntegrationStorageHandle;
    sourceControl: SourceControlStorageHandle;
  };
  /** System hooks integrations may invoke. */
  hooks?: IntegrationHooks;
}

/** Authentication material accepted by integration capabilities. */
export type IntegrationConnection =
  { type: 'app-installation'; installationId: number } | { type: 'oauth'; accessToken: string };

/** Provider-neutral issue returned by every Intake integration. */
export interface IntakeIssue {
  id: string;
  identifier: string;
  title: string;
  url: string;
  author: string | null;
  state: string | null;
  stateType: string | null;
  priority: string | null;
  assignee: string | null;
  source: string | null;
  labels: string[];
  commentCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeIssueComment {
  author: string | null;
  body: string;
  createdAt: string;
}

export interface IntakeIssueDetail extends IntakeIssue {
  description: string | null;
  comments: IntakeIssueComment[];
}

export interface IntakeIssuePage {
  issues: IntakeIssue[];
  nextCursor: string | null;
}

export interface ListIntakeIssuesInput {
  connection: IntegrationConnection;
  /** Provider-defined source ids: repositories for GitHub, projects for Linear. */
  sourceIds: string[];
  cursor?: string;
}

export interface GetIntakeIssueInput {
  connection: IntegrationConnection;
  sourceId?: string;
  issueId: string;
}

export interface CreateIntakeCommentInput extends GetIntakeIssueInput {
  body: string;
}

export interface CreatedIntakeComment {
  id: string;
  url: string;
}

/** Fixed issue-oriented contract implemented by GitHub, Linear, and future sources. */
export interface Intake {
  listIssues(input: ListIntakeIssuesInput): Promise<IntakeIssuePage>;
  getIssue(input: GetIntakeIssueInput): Promise<IntakeIssueDetail | null>;
  createComment(input: CreateIntakeCommentInput): Promise<CreatedIntakeComment | null>;
}

export interface VersionControlPullRequest {
  id: string;
  title: string;
  url: string;
  author: string | null;
  baseBranch: string;
  headBranch: string;
  createdAt: string;
  updatedAt: string;
}

export interface VersionControlPullRequestPage {
  pullRequests: VersionControlPullRequest[];
  nextCursor: string | null;
}

export interface ListVersionControlPullRequestsInput {
  connection: IntegrationConnection;
  sourceId: string;
  cursor?: string;
}

/** Fixed repository and pull-request contract implemented by source-control integrations. */
export interface VersionControl {
  listPullRequests(input: ListVersionControlPullRequestsInput): Promise<VersionControlPullRequestPage>;
}

/**
 * A pluggable web integration. Implementations own their credentials
 * (validated at construction), their API surface, and their HTTP routes.
 */
export interface FactoryIntegration {
  /** Stable identifier: `'github'`, `'linear'`, custom ids for third parties. */
  readonly id: string;
  /** Issue-oriented capability consumed by Intake. */
  readonly intake?: Intake;
  /** Repository and pull-request capability consumed by version-control flows. */
  readonly versionControl?: VersionControl;
  /**
   * The integration's full HTTP surface (status, OAuth, webhooks, feature
   * routes), as Mastra `apiRoutes`. Called once at boot; the factory folds
   * the result into the server's route table.
   */
  routes(ctx: IntegrationContext): ApiRoute[];
  /**
   * Org-scoped agent tools resolved per request (e.g. Linear's issue tools).
   * Optional capability; the factory merges results into the SDK's async
   * `extraTools` provider.
   */
  agentTools?(args: { requestContext: RequestContext }): Promise<IntegrationTools>;
  /**
   * Session-scoped tools (e.g. GitHub's PR subscribe/unsubscribe). Optional
   * capability, resolved synchronously per request.
   */
  sessionTools?(requestContext: RequestContext): IntegrationTools;
  /**
   * Background workers the integration needs running for its lifecycle
   * (e.g. polling an upstream that doesn't support webhooks). Optional
   * capability: called once at boot for READY integrations only; the factory
   * folds the returned workers into the server Mastra's `workers` option, so
   * they are merged with the built-in workers and started with them
   * (`startWorkers()`). Worker names must be unique across integrations —
   * duplicates fail the `new Mastra(...)` construction loudly.
   */
  workers?(ctx: IntegrationContext): MastraWorker[];
  /**
   * Non-secret config snapshot (booleans + names only, never values). The
   * factory merges it into system diagnostics/startup logs.
   */
  diagnostics(): Record<string, unknown>;
  /**
   * True when the integration signs OAuth `state` and therefore needs a
   * replica-stable signer. The factory fails loud at boot when a registered
   * integration requires stability but only a per-process random secret is
   * available (see `./state-signing.ts`).
   */
  readonly requiresStableStateSigner?: boolean;
}

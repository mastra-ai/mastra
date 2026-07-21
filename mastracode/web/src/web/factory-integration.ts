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

import type { AuditEmitter } from './audit/domain.js';
import type { AuditEventRow } from './storage/domains/audit/base.js';
import type { StateSigner } from './state-signing.js';
import type { IntegrationStorageHandle } from './storage/domains/integrations/base.js';
import type {
  SourceControlInstallation,
  SourceControlRepository,
  SourceControlStorageHandle,
} from './storage/domains/source-control/base.js';

export interface IntakeSource {
  id: string;
  name: string;
  type: string;
  metadata?: Record<string, unknown>;
}

export interface IntakeItem {
  source: {
    type: string;
    externalId: string;
    url?: string;
  };
  sourceId: string;
  title: string;
  status?: string;
  labels?: string[];
  assignee?: string | null;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface IntakePage {
  items: IntakeItem[];
  nextCursor: string | null;
}

export interface IntakeIntegrationCapability {
  listSources(args: { orgId: string; userId: string }): Promise<IntakeSource[]>;
  listItems(args: { orgId: string; userId: string; sourceIds: string[]; cursor?: string }): Promise<IntakePage>;
}

export interface SourceControlInstallationInput {
  externalId: string;
  accountName?: string | null;
  accountType?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SourceControlRepositoryInput {
  externalId: string;
  slug: string;
  defaultBranch: string;
  metadata?: Record<string, unknown>;
}

export interface SourceControlRepositoryAccess {
  cloneUrl: string;
  authorization?: { scheme: 'bearer'; token: string };
}

export interface SourceControlIntegrationCapability {
  initialize(args: { storage: SourceControlStorageHandle }): void;
  registerInstallation(args: {
    orgId: string;
    userId: string;
    installation: SourceControlInstallationInput;
  }): Promise<SourceControlInstallation>;
  registerRepositories(args: {
    orgId: string;
    installationId: string;
    repositories: SourceControlRepositoryInput[];
  }): Promise<SourceControlRepository[]>;
  getRepositoryAccess(args: { orgId: string; repositoryId: string }): Promise<SourceControlRepositoryAccess>;
}

/** Factory-owned hooks integrations may invoke. */
export interface IntegrationHooks {
  emitAudit?: AuditEmitter['emit'];
}

/**
 * Tool records integrations contribute — the same static-record shape the
 * SDK's `extraTools` accepts, so the factory can merge every integration's
 * tools into one dynamic tool set.
 */
export type IntegrationTools = Extract<NonNullable<MastraCodeConfig['extraTools']>, Record<string, unknown>>;

export interface IntegrationPostToolContext {
  toolName: string;
  input: unknown;
  output?: unknown;
  error?: unknown;
  context: unknown;
}

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
  stateSigner?: StateSigner;
  /** Persistence handles pre-scoped to this integration's stable id. */
  storage: {
    generic: IntegrationStorageHandle;
    sourceControl: SourceControlStorageHandle;
  };
  /** System hooks integrations may invoke. */
  hooks?: IntegrationHooks;
}

/**
 * A pluggable web integration. Implementations own their credentials
 * (validated at construction), their API surface, and their HTTP routes.
 */
export interface FactoryIntegration {
  /** Stable identifier: `'github'`, `'linear'`, custom ids for third parties. */
  readonly id: string;
  /** Optional normalized external-work intake capability. */
  readonly intake?: IntakeIntegrationCapability;
  /** Optional provider-neutral source-control capability. */
  readonly sourceControl?: SourceControlIntegrationCapability;
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
  sessionTools?(args: { requestContext: RequestContext }): IntegrationTools;
  /**
   * Optional provider-owned observer for successful or failed tool calls.
   * The factory invokes every configured observer independently so one
   * integration cannot prevent another from observing the same tool result.
   */
  postToolObserver?(args: { toolContext: IntegrationPostToolContext; requestContext?: RequestContext }): Promise<void>;
  /**
   * Non-secret config snapshot (booleans + names only, never values). The
   * factory merges it into system diagnostics/startup logs.
   */
  diagnostics(): Record<string, unknown>;
  /**
   * Optional best-effort destination for locally persisted audit events.
   * Audit export remains independent of the configured web auth adapter.
   */
  audit?(args: { event: AuditEventRow }): Promise<void>;
  /**
   * True when the integration signs OAuth `state` and therefore needs a
   * replica-stable signer. The factory fails loud at boot when a registered
   * integration requires stability but only a per-process random secret is
   * available (see `./state-signing.ts`).
   */
  readonly requiresStableStateSigner?: boolean;
}

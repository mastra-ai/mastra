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
import type { FactoryStorage } from '@mastra/core/storage';
import type { MastraWorker } from '@mastra/core/worker';

import type { Intake } from '../capabilities/intake.js';
import type { VersionControl } from '../capabilities/version-control.js';
import type { RouteAuth } from '../routes/route.js';
import type { FactoryRules } from '../rules/types.js';
import type { SandboxFleet } from '../sandbox/fleet.js';
import type { StateSigner } from '../state-signing.js';
import type { AuditEventRow } from '../storage/domains/audit/base.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import type { IntakeStorage } from '../storage/domains/intake/base.js';
import type { IntegrationStorageHandle } from '../storage/domains/integrations/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

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
  /** Host auth seam — integration routes resolve callers through this. */
  auth: RouteAuth;
  /**
   * Sandbox fleet for per-project sandboxes. Always constructed at boot; a
   * fleet built without a machine config reports `enabled: false` and
   * sandbox-backed routes respond 503.
   */
  fleet: SandboxFleet;
  /**
   * Root factory storage backend. Supplies the cross-replica
   * `withDistributedLock` capability and the `appDbConfigured` diagnostic.
   * Absent when the host runs without an application database.
   */
  factoryStorage?: FactoryStorage;
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
    /** Factory projects domain — e.g. resolving a project's default model. */
    projects: FactoryProjectsStorage;
    /** Cross-integration intake selection (which sources are synced). */
    intake: IntakeStorage;
  };
  /**
   * Factory rule runtime available when the work-item domain is ready.
   * Integrations attach their own provider event rules to their ingress
   * surfaces instead of relying on provider-specific services in the host.
   */
  rules?: {
    config: FactoryRules;
    workItems: WorkItemsStorage;
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
  /** Issue-oriented capability consumed by Intake. */
  readonly intake?: Intake;
  /** Repository, installation, and pull-request capability. */
  readonly versionControl?: VersionControl;
  /**
   * Bind the integration's generic persistence handle. Called once by the
   * factory during `prepare()` (before routes/tools/workers are collected),
   * so instance methods that run outside an `IntegrationContext` — per-request
   * agent tools, intake capability calls — reach storage without a service
   * locator. Mirrors `sourceControl.initialize`.
   */
  initialize?(args: { storage: IntegrationStorageHandle; projects: FactoryProjectsStorage; auth: RouteAuth }): void;
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

/**
 * Harness v1 — Workspace provider contract (§2.7, §9).
 *
 * A `WorkspaceProvider` is the harness-side adapter that creates (and, for
 * resumable shapes, resumes) `Workspace` instances on behalf of sessions.
 * The contract is intentionally small: providers own creation, optional
 * resumption from opaque state bytes, and (optionally) custom destruction.
 *
 * Three ownership models drive when providers are invoked:
 *
 *   - `shared`: a single workspace per harness, torn down at shutdown.
 *   - `per-resource`: one workspace per `resourceId`, ref-counted.
 *   - `per-session`: a fresh workspace per session, with state durably
 *     persisted in `SessionRecord.workspace` when `resumable: true`.
 *
 * Providers that want durability call `ctx.pushState(...)` after every
 * relevant state change. The harness threads the persistence call through
 * the session's flush chain so the bytes land on the session record
 * atomically with the version bump.
 *
 * `Workspace` itself is intentionally untouched — push-state lives entirely
 * on the provider contract.
 */

import { randomUUID } from 'node:crypto';
import type { Workspace } from '../../workspace';

/** Workspace ownership models (§2.7). */
export type WorkspaceOwnershipKind = 'shared' | 'per-resource' | 'per-session';

/**
 * Context passed to provider `create` / `resume` calls. `sessionId` is
 * present for `per-session` providers; `resourceId` is always set.
 *
 * `pushState` is the durable "save these bytes" hook. Providers that don't
 * support resumption (`resumable: false`) may still call it — the harness
 * will simply skip persistence for non-resumable shapes.
 */
export interface WorkspaceProviderContext {
  resourceId: string;
  sessionId?: string;
  parentSessionId?: string;
  pushState: (state: unknown) => Promise<void>;
}

/**
 * Provider contract. `providerId` is stable identity persisted alongside
 * the session record so we can detect mismatched configs after restart.
 * `resumable` is a static declaration validated at construction.
 */
export interface WorkspaceProvider {
  /** Stable identity. Persisted in `SessionRecord.workspace.providerId`. */
  readonly providerId: string;

  /** Whether `resume({ state })` is supported. Required by `kind: 'per-session'`. */
  readonly resumable: boolean;

  /** Create a fresh workspace for this context. */
  create(ctx: WorkspaceProviderContext): Promise<Workspace>;

  /**
   * Resume a workspace from previously-pushed state. Only invoked when
   * `resumable: true` AND the session record carries `workspace.state`.
   */
  resume?(ctx: WorkspaceProviderContext & { state: unknown }): Promise<Workspace>;

  /**
   * Optional custom teardown. When omitted the harness falls back to
   * calling `workspace.destroy()` directly.
   */
  destroy?(workspace: Workspace, ctx: WorkspaceProviderContext): Promise<void>;
}

/**
 * Wrap a bare factory function as a non-resumable provider. Used as
 * shorthand under `kind: 'per-resource'`; rejected at config validation
 * under `kind: 'per-session'` because per-session resumption requires the
 * full provider shape.
 */
export function nonDurableProvider(
  fn: (ctx: WorkspaceProviderContext) => Workspace | Promise<Workspace>,
  opts?: { providerId?: string },
): WorkspaceProvider {
  return {
    providerId: opts?.providerId ?? `non-durable-${randomUUID()}`,
    resumable: false,
    create: async ctx => Promise.resolve(fn(ctx)),
  };
}

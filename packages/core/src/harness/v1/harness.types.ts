import type { Agent } from '../../agent';
import type { Mastra } from '../../mastra';
import type { MastraCompositeStore } from '../../storage';
import type { HarnessMode } from './mode';

export interface HarnessConfigCommon<MODES extends HarnessMode[]> {
  /**
   * Operator-managed compatibility token for the configured runtime surface:
   * agents and prompts/tools, mode-to-agent bindings, model aliases, MCP
   * bindings, workspace provider wiring, and wrappers that affect run
   * semantics. Harness does not derive this value. Operators bump it when a
   * change is incompatible with non-terminal persisted work.
   *
   * When set, recoverable work snapshots the token and later fails closed with
   * `harness.runtime_dependency_drifted` if replay/resume observes a different
   * current token, including when a previously configured token is later unset.
   * Legacy rows without a snapshot continue ID-only validation.
   */
  runtimeCompatibilityGeneration?: string;

  /**
   * Operating modes. Each mode pins a backing agent and may override or
   * extend its tool surface and instructions. Mode ids must be unique;
   * each mode's `agentId` must reference an agent visible to the harness
   * (either through the parent Mastra or the inline `agents` map); each
   * mode's optional `transitionsTo` must reference another mode's `id`.
   * All validated at construction (or, for the registered-on-Mastra
   * shape, at registration time).
   *
   * May be empty (e.g. for harnesses that drive a single agent with no
   * mode policy). When empty, `defaultModeId` must also be omitted.
   *
   * See §9 and §4.2.
   */
  modes: MODES;

  /**
   * Default mode for fresh sessions when no `modeId` override is supplied
   * on `harness.session(...)`. Must reference a `modes[].id`. Required if
   * `modes` is non-empty; must be omitted otherwise.
   *
   * Explicit (rather than implicit `modes[0]`) so that reordering the
   * `modes` array can never silently change runtime behavior.
   */
  defaultModeId?: MODES[number]['id'];

  /**
   * Session-runtime config (§9 + §5). Currently only carries the storage
   * binding override; eviction, lease, and queue knobs land here as we
   * wire them up.
   */
  // sessions?: {
  /**
   * Override for where SessionRecords, leases, and attachment metadata
   * are persisted. Defaults to the harness domain on the Mastra
   * instance's storage (`mastra.getStorage().stores.harness`). Pass
   * a custom adapter only if the harness needs to persist into a
   * different store than the rest of the Mastra app.
   *
   * Thread records and messages still live in the bound Mastra memory
   * store. If the session storage override is not the same object as the
   * bound Mastra storage's `stores.harness` domain, `threads.delete(...)`
   * fails closed before deleting session rows or global memory
   * thread/message rows for that harness. A separate session storage may only
   * attach to an existing memory thread; Harness writes a reserved internal
   * marker so later `threads.delete(...)` calls in other processes fail
   * closed instead of deleting global thread/message rows they cannot prove
   * are unowned.
   */
  //   storage?: HarnessStorage;

  //   /**
  //    * Maximum number of items allowed to wait in `pendingQueue` per session.
  //    * `session.queue(...)` rejects with `HarnessQueueFullError` when full.
  //    * Capacity check + durable append are atomic per session. Defaults to 100.
  //    */
  //   maxQueueDepth?: number;

  //   /**
  //    * Queue-full behavior. `reject` preserves the historical behavior and
  //    * throws `HarnessQueueFullError` when the session queue is full.
  //    * `drop-oldest` removes the oldest waiting queued item and records a
  //    * `queue_full_dropped` event before admitting the replacement. The active
  //    * queued head is never dropped by backpressure.
  //    */
  //   queueBackpressure?: HarnessQueueBackpressurePolicy;

  //   /**
  //    * Milliseconds allowed after the durable `closingAt` marker commits for
  //    * live sessions to drain admitted work before terminal `closedAt`. The
  //    * runtime persists `closeDeadlineAt = closingAt + closeTimeoutMs` and
  //    * reuses an existing deadline when repairing a partially completed close.
  //    * Must be a positive integer. Defaults to 30_000 ms (30s).
  //    */
  //   closeTimeoutMs?: number;
  // };

  // /**
  //  * Attachment ingress policy for inline, URL-ingested, and staged remote
  //  * attachments. Defaults are enforced by server/SDK consumers when a field is
  //  * omitted.
  //  */
  // files?: HarnessFileConfig;

  // /**
  //  * Subagent type registry (§9). When `types` is non-empty, the harness
  //  * registers a built-in `spawn_subagent` tool on every session. The tool's
  //  * `agentType` enum is drawn from the keys of this map.
  //  *
  //  * Validated at construction (or registration): each entry's `agentId`
  //  * must reference an agent visible to the harness, and each entry's
  //  * optional `modeId` must reference a mode in `modes`. Unknown ids throw
  //  * `HarnessConfigError`.
  //  *
  //  * `maxDepth` caps the subagent tree depth. A `spawn_subagent` call from
  //  * a session at depth equal to or greater than `maxDepth` returns a tool
  //  * error containing `HarnessSubagentDepthExceededError`. Default: `1`
  //  * (the top-level session can spawn one level of subagents).
  //  */
  // subagents?: {
  //   maxDepth?: number;
  //   types: Record<string, SubagentDefinition>;
  // };

  // /**
  //  * Goal-loop defaults (§4.7). When a session calls `setGoal({ objective })`
  //  * without an explicit judge model or budget, these defaults are used.
  //  *
  //  * `defaultJudgeModel` falls back to the session's current model id when
  //  * unset. `defaultMaxTurns` defaults to 50.
  //  */
  // goals?: {
  //   defaultJudgeModel?: string;
  //   defaultMaxTurns?: number;
  // };

  // /**
  //  * Default policy applied when a tool's resolved category has no rule and
  //  * no per-tool override (§4.2e). Set to `'allow'` to opt out of the gate
  //  * entirely; set to `'deny'` for a strict allow-list posture. Defaults to
  //  * `'ask'`.
  //  */
  // defaultPermissionPolicy?: PermissionPolicy;

  // /**
  //  * Resolves a tool name to its category for permission-gate evaluation
  //  * (§4.2e). Returning `null` leaves the tool uncategorised — only per-tool
  //  * rules apply, and `defaultPermissionPolicy` is the floor.
  //  *
  //  * Pure function — must not read from the harness or perform IO. Called
  //  * synchronously inside the gate.
  //  *
  //  * The function form is primary. {@link toolCategories} is accepted as
  //  * optional sugar and desugars to `(name) => toolCategories[name] ?? null`
  //  * at construction time. When both are provided the resolver wins.
  //  */
  // toolCategoryResolver?: (toolName: string) => ToolCategory | null;

  // /**
  //  * Optional sugar for {@link toolCategoryResolver} — a static
  //  * `toolName -> ToolCategory` map. Equivalent to passing a resolver of
  //  * `(name) => toolCategories[name] ?? null`. Ignored when
  //  * `toolCategoryResolver` is also set.
  //  */
  // toolCategories?: Record<string, ToolCategory>;

  // /**
  //  * Static catalog of model entries that the harness exposes through
  //  * `harness.models.*`. Lets UIs render a model picker and surface
  //  * per-model metadata (display name, context window, capability hints)
  //  * without going through provider plumbing.
  //  *
  //  * Each `id` must be unique within the catalog — duplicate ids throw
  //  * `HarnessConfigError` at construction. May be omitted entirely; in
  //  * that case `harness.models.list()` returns `[]` and
  //  * `harness.models.getAuthStatus()` throws
  //  * `HarnessModelNotFoundError` for every id.
  //  *
  //  * The catalog is not validated against {@link modes} — modes may
  //  * reference agents whose model is outside the catalog, and the catalog
  //  * may include models not currently bound to any mode. The catalog is
  //  * purely a UX surface.
  //  */
  // models?: ModelInfo[];

  // /**
  //  * Static, code-registered skills. These are merged ahead of the session's
  //  * workspace-discovered skills for `session.skills.list/get/use`.
  //  *
  //  * Each `name` must be unique within this array. When a workspace skill has
  //  * the same `name`, this code-registered descriptor wins.
  //  */
  // skills?: HarnessSkill[];

  // /**
  //  * Resolves a catalog model id to its current auth status. Called by
  //  * `harness.models.getAuthStatus(modelId)`. May return a `Promise`.
  //  *
  //  * The harness does not cache the resolver's result — every
  //  * `getAuthStatus()` call re-invokes it, since auth state changes
  //  * out-of-band (login/logout flows, expiring tokens). Implementations
  //  * should be cheap (read a credential file, check a cached provider
  //  * client, etc.) and never throw — surface unknowable cases as
  //  * `'unknown'`.
  //  *
  //  * If omitted, every authenticated lookup resolves to `'unknown'`.
  //  */
  // modelAuthStatusResolver?: (modelId: string) => ModelAuthStatus | Promise<ModelAuthStatus>;

  // /**
  //  * Harness channel bridge configuration (§9.3 / §14). Each record binds a
  //  * harness-local `channelId` to a registered Mastra `ChannelProvider`.
  //  * When set, construct with a parent `mastra` or register the harness through
  //  * `new Mastra({ channels, harnesses })` so provider bindings exist.
  //  *
  //  * This validates identity only. Later channel work consumes these bindings to
  //  * mount ingress/action routes and durable inbox/outbox workers.
  //  */
  // channels?: Record<string, HarnessChannelConfig>;

  // /**
  //  * Workspace configuration (§2.7). Selects one of three ownership models —
  //  * `shared` (one workspace for the whole harness), `per-resource` (one per
  //  * `resourceId`, refcounted across that user's sessions), or `per-session`
  //  * (one per session, persisted in `SessionRecord.workspace`).
  //  *
  //  * `shared` accepts either a pre-built `Workspace` or a factory matching the
  //  * legacy harness signature `({ requestContext }) => Workspace`. `per-resource`
  //  * accepts the factory shorthand or a full `WorkspaceProvider`. `per-session`
  //  * requires the full `WorkspaceProvider` shape with `resumable: true` —
  //  * factory shorthands resolve to non-resumable providers and are rejected
  //  * at startup with `HarnessConfigError`.
  //  *
  //  * Provisioning is lazy by default; pass `eager: true` to provision on
  //  * `init()` / session create.
  //  */
  // workspace?: HarnessWorkspaceConfig;

  // // Remaining fields (files, intervals, observationalMemory) land here as we
  // // wire them up.

  // [key: string]: unknown;
}

export type HarnessConfig<MODES extends HarnessMode[]> = HarnessConfigCommon<MODES> &
  (
    | {
        /**
         * Pre-built Mastra instance to drive this harness. Mutually
         * exclusive with top-level `agents` / `storage`.
         *
         * Prefer omitting this field when you want the parent `Mastra` to own
         * registration (`new Mastra({ harnesses })`).
         * A harness that is already bound to the same `Mastra` may still be
         * registered there under a configured harness name.
         */
        mastra: Mastra;
        agents?: never;
        storage?: never;
      }
    | {
        mastra?: never;
        /**
         * Agents addressable by id. `HarnessMode.agentId` references resolve
         * against the keys of this map. Validated at construction — an
         * unknown id in any mode throws `HarnessConfigError`. May be omitted
         * when the harness will be registered onto an existing Mastra.
         */
        agents: Record<string, Agent>;

        /**
         * Storage backing the internal Mastra. Optional — the in-memory
         * default is fine for tests and short-lived scripts. Required for
         * any harness that survives process restart.
         */
        storage: MastraCompositeStore;
      }
  );

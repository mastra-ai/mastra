/**
 * Framework-agnostic Generative UI (GenUI) contracts.
 *
 * Everything in this module is JSON-serializable so it can ride the native
 * Mastra stream as a `data-gen-ui` custom chunk, be persisted as an ordinary
 * `data-*` message part, and be replayed deterministically on reload.
 */

/**
 * Current GenUI wire protocol version. Envelopes with a different version are rejected.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export const GENUI_PROTOCOL_VERSION = 1 as const;

/**
 * The `data-*` chunk/part type that carries GenUI envelopes on the Mastra stream.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export const GENUI_DATA_PART_TYPE = 'data-gen-ui' as const;

/** @experimental Generative UI is in beta and may change without notice. */
export type JSONPrimitive = string | number | boolean | null;
/** @experimental Generative UI is in beta and may change without notice. */
export type JSONValue = JSONPrimitive | JSONValue[] | JSONObject;
/** @experimental Generative UI is in beta and may change without notice. */
export type JSONObject = { [key: string]: JSONValue };

/** @experimental Generative UI is in beta and may change without notice. */
export type GenUISurfaceStatus = 'streaming' | 'ready' | 'suspended' | 'failed' | 'aborted';

/**
 * Where a surface is rendered. `inline` surfaces render inside the message that
 * created them; every other placement is rendered by an explicit outlet that the
 * application mounts (e.g. a side panel).
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export type GenUIPlacement = 'inline' | 'panel' | 'standalone' | 'overlay';

/**
 * Which agent/run/tool produced a surface. Informational only — never used for authorization.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export interface GenUISurfaceSource {
  agentId?: string;
  runId?: string;
  toolCallId?: string;
  workflowId?: string;
}

/**
 * A node as sent on the wire.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export interface GenUINodeInput {
  id: string;
  /** Registry key of the component that renders this node. */
  component: string;
  props?: JSONObject;
  /** Ordered child node ids. */
  children?: string[];
}

/**
 * A node as held in normalized surface state.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export interface GenUINode {
  id: string;
  component: string;
  props: JSONObject;
  children: string[];
  /** Surface revision at which this node was last changed. Used for stale-action detection. */
  revision: number;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUISurface {
  id: string;
  protocolVersion: typeof GENUI_PROTOCOL_VERSION;
  /** Number of envelopes applied to this surface. Deterministic over replay. */
  revision: number;
  status: GenUISurfaceStatus;
  rootId: string | null;
  nodes: Readonly<Record<string, GenUINode>>;
  /** Agent-owned surface data. Client-local edits live in the GenUI state store, not here. */
  data: JSONObject;
  placement: GenUIPlacement;
  catalogId?: string;
  catalogVersion?: string;
  title?: string;
  source?: GenUISurfaceSource;
  error?: string;
  /** Event id of the envelope that created the surface; its message part is the inline anchor. */
  anchorEventId: string;
}

/** @experimental Generative UI is in beta and may change without notice. */
export type GenUIOperation =
  | {
      op: 'createSurface';
      rootId?: string;
      placement?: GenUIPlacement;
      catalogId?: string;
      catalogVersion?: string;
      title?: string;
      source?: GenUISurfaceSource;
      data?: JSONObject;
      nodes?: GenUINodeInput[];
    }
  /** Insert or fully replace nodes. Omitted `props`/`children` default to empty. */
  | { op: 'upsertNodes'; nodes: GenUINodeInput[] }
  /** Shallow-merge `set` into a node's props and delete the `unset` keys. */
  | { op: 'updateProps'; nodeId: string; set?: JSONObject; unset?: string[] }
  /** Remove nodes and their descendants; references from parents are dropped. */
  | { op: 'removeNodes'; nodeIds: string[] }
  /** Replace a node's ordered children. Covers insert, delete and reorder. */
  | { op: 'setChildren'; nodeId: string; children: string[] }
  | { op: 'setRoot'; rootId: string | null }
  | { op: 'replaceData'; data: JSONObject }
  /** Shallow-merge `set` into surface data and delete the `unset` keys. */
  | { op: 'patchData'; set?: JSONObject; unset?: string[] }
  | { op: 'setStatus'; status: GenUISurfaceStatus; error?: string }
  | { op: 'deleteSurface' };

/** @experimental Generative UI is in beta and may change without notice. */
export type GenUIOperationName = GenUIOperation['op'];

/**
 * The single versioned envelope carried as `data` of a `data-gen-ui` chunk.
 * Operations in one envelope are applied atomically: either all apply or none.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export interface GenUIEnvelope {
  version: typeof GENUI_PROTOCOL_VERSION;
  /** Globally unique id used for deduplication across reconnects and replays. */
  eventId: string;
  surfaceId: string;
  /**
   * Optional optimistic-concurrency guard. When set, the envelope only applies
   * when the surface is exactly at this revision. Lower values are rejected as
   * stale; higher values are buffered until the gap is filled.
   */
  baseRevision?: number;
  operations: GenUIOperation[];
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUILimits {
  maxSurfaces: number;
  maxNodesPerSurface: number;
  maxTreeDepth: number;
  maxOperationsPerEnvelope: number;
  maxIdLength: number;
  maxChildrenPerNode: number;
  /** Max serialized size (UTF-16 code units) of a single node's props. */
  maxPropsSize: number;
  /** Max serialized size of a surface's data object. */
  maxDataSize: number;
  /** Max nesting depth of any JSON value (props, data, payloads). */
  maxValueDepth: number;
  /** Max out-of-order envelopes buffered per surface while waiting for a gap to fill. */
  maxBufferedEnvelopes: number;
  /** Max diagnostics retained in state. */
  maxDiagnostics: number;
}

/** @experimental Generative UI is in beta and may change without notice. */
export const DEFAULT_GENUI_LIMITS: Readonly<GenUILimits> = Object.freeze({
  maxSurfaces: 100,
  maxNodesPerSurface: 500,
  maxTreeDepth: 32,
  maxOperationsPerEnvelope: 200,
  maxIdLength: 128,
  maxChildrenPerNode: 200,
  maxPropsSize: 32_768,
  maxDataSize: 262_144,
  maxValueDepth: 24,
  maxBufferedEnvelopes: 50,
  maxDiagnostics: 50,
});

/** @experimental Generative UI is in beta and may change without notice. */
export type GenUIDiagnosticCode =
  | 'invalid-envelope'
  | 'unsupported-version'
  | 'duplicate-event'
  | 'stale-revision'
  | 'buffered-gap'
  | 'buffer-overflow'
  | 'unknown-surface'
  | 'surface-exists'
  | 'invalid-operation'
  | 'limit-exceeded'
  | 'invalid-graph';

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIDiagnostic {
  code: GenUIDiagnosticCode;
  message: string;
  eventId?: string;
  surfaceId?: string;
}

/**
 * Normalized, immutable GenUI state derived from a sequence of envelopes.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export interface GenUIState {
  surfaces: Readonly<Record<string, GenUISurface>>;
  /** Surface ids in creation order. */
  surfaceOrder: readonly string[];
  /** Event ids already applied or rejected, used for idempotent replay. */
  seenEventIds: Readonly<Record<string, true>>;
  /** Envelopes waiting for an earlier revision, keyed by surface id. */
  buffered: Readonly<Record<string, readonly GenUIEnvelope[]>>;
  diagnostics: readonly GenUIDiagnostic[];
}

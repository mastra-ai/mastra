export const ENGINES = ['plain', 'durable', 'evented'] as const;
export type Engine = (typeof ENGINES)[number];

export type Backend = 'memory' | 'redis' | 'valkey';

/** `single`: publisher and readers share one process. `split`: readers run in another process. */
export type Topology = 'single' | 'split';

export interface Layout {
  topology: Topology;
  backend: Backend;
}

/** Split needs a shared bus, so the in-memory backend only runs in one process. */
export const LAYOUTS: readonly Layout[] = [
  { topology: 'single', backend: 'memory' },
  { topology: 'single', backend: 'redis' },
  { topology: 'single', backend: 'valkey' },
  { topology: 'split', backend: 'redis' },
  { topology: 'split', backend: 'valkey' },
];

export type LayoutName = `${Topology}/${Backend}`;
export const layoutName = (layout: Layout): LayoutName => `${layout.topology}/${layout.backend}`;

/**
 * - `live`: the caller's own `fullStream`.
 * - `observe-mid`: `agent.observe(runId)` attached in the reader process as soon as the run starts.
 * - `topic`: the raw run topic (`agent.stream.<runId>`) read back from the replay cache.
 * - `observe-0`: `agent.observe(runId)` from the start of the log, after the turn.
 * - `http-observe`: the server's `POST /api/agents/:agentId/observe` route, after the turn.
 * - `thread`: `agent.subscribeToThread()` in the reader process, subscribed before the turn.
 */
export const READERS = ['live', 'observe-mid', 'topic', 'observe-0', 'http-observe', 'thread'] as const;
export type ReaderName = (typeof READERS)[number];

/**
 * One delivered frame, reduced to what a reader can rely on. `shape` carries
 * the user-visible content of frames whose content matters (joined text,
 * structured objects, error shape); it is absent for frames where only the
 * type is compared.
 */
export interface Frame {
  type: string;
  shape?: string;
}

export type RunCapture = Partial<Record<ReaderName, Frame[]>>;

export interface Cell {
  scenario: string;
  engine: Engine;
  backend: Backend;
  topology: Topology;
}

/**
 * - `sequence`: the frame types differ.
 * - `shape`: same frame types, different content in at least one frame.
 */
export type DifferenceKind = 'sequence' | 'shape';

/** Which reference a reader was compared against: the same run's live stream, or plain's same reader. */
export type Reference = 'live' | 'plain';

export interface Difference extends Cell {
  reader: ReaderName;
  against: Reference;
  kind: DifferenceKind;
  /** Deterministic description of the difference; listed entries must match it exactly. */
  detail: string;
}

/**
 * - `durable-stream`: produced by durable's own stream code (bus, publisher, read-back, observe);
 *   expected to disappear once durable runs on plain's stream layer.
 * - `engine`: produced by the execution engine (the chunks themselves differ); execution work.
 * - `plain-layer`: a bug in plain's stream layer, the layer that survives consolidation.
 */
export type Cause = 'durable-stream' | 'engine' | 'plain-layer';

export interface KnownDifference {
  scenario: string;
  engine: Engine;
  /** Omit to match every backend. */
  backend?: Backend;
  /** Omit to match every topology. */
  topology?: Topology;
  reader: ReaderName;
  against: Reference;
  kind: DifferenceKind;
  detail: string;
  /** Linear ticket, e.g. `COR-1390`. */
  ticket: string;
  cause: Cause;
  /** file:line or probe that shows the cause. */
  evidence: string;
}

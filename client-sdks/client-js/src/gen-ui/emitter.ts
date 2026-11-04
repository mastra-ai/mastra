import { v4 as uuid } from '@lukeed/uuid';
import { resolveGenUILimits } from './accumulator';
import { GENUI_DATA_PART_TYPE, GENUI_PROTOCOL_VERSION } from './types';
import type {
  GenUIEnvelope,
  GenUILimits,
  GenUINodeInput,
  GenUIOperation,
  GenUISurfaceSource,
  GenUISurfaceStatus,
  JSONObject,
} from './types';
import { parseGenUIOperations } from './validate';

/** The `data-gen-ui` chunk written to the Mastra stream. */
export interface GenUIChunk {
  type: typeof GENUI_DATA_PART_TYPE;
  data: GenUIEnvelope;
}

/**
 * Anything that can write a custom `data-*` chunk to the Mastra stream —
 * typically the `writer` passed to a tool's or workflow step's `execute`.
 */
export interface GenUIChunkWriter {
  custom(chunk: GenUIChunk): unknown;
}

export interface GenUIEmitterOptions {
  /** Attached to `createSurface` operations that do not set their own `source`. */
  source?: GenUISurfaceSource;
  limits?: Partial<GenUILimits>;
  /** Override event id generation (useful for deterministic tests). */
  generateEventId?: () => string;
}

export interface GenUISurfaceEmitterOptions {
  /**
   * Revision the surface is known to be at. Set this when continuing a surface
   * created by an earlier run so the client can detect stale or out-of-order
   * updates. When omitted, the first envelope applies in arrival order and
   * later envelopes from this emitter are revision-guarded automatically.
   */
  baseRevision?: number;
}

export type GenUICreateSurfaceInput = Omit<Extract<GenUIOperation, { op: 'createSurface' }>, 'op'>;

export interface GenUISurfaceEmitter {
  readonly surfaceId: string;
  /** Validate and write a batch of operations as one atomic envelope. */
  send(operations: GenUIOperation[]): Promise<GenUIEnvelope>;
  create(input?: GenUICreateSurfaceInput): Promise<GenUIEnvelope>;
  upsertNodes(nodes: GenUINodeInput[]): Promise<GenUIEnvelope>;
  updateProps(nodeId: string, set: JSONObject, unset?: string[]): Promise<GenUIEnvelope>;
  removeNodes(nodeIds: string[]): Promise<GenUIEnvelope>;
  setChildren(nodeId: string, children: string[]): Promise<GenUIEnvelope>;
  setRoot(rootId: string | null): Promise<GenUIEnvelope>;
  replaceData(data: JSONObject): Promise<GenUIEnvelope>;
  patchData(set: JSONObject, unset?: string[]): Promise<GenUIEnvelope>;
  setStatus(status: GenUISurfaceStatus, error?: string): Promise<GenUIEnvelope>;
  delete(): Promise<GenUIEnvelope>;
}

export interface GenUIEmitter {
  surface(surfaceId: string, options?: GenUISurfaceEmitterOptions): GenUISurfaceEmitter;
}

/**
 * Server-side helper that turns typed GenUI operations into `data-gen-ui`
 * chunks on the native Mastra stream.
 *
 * Operations are validated with the same rules the client applies, so a
 * malformed update fails loudly on the server instead of silently on the
 * client. Chunks are not transient: they persist as ordinary `data-*` message
 * parts, which is what makes reload/replay work.
 *
 * @example
 * ```ts
 * execute: async (input, { writer }) => {
 *   const ui = createGenUIEmitter(writer).surface(`weather-${input.city}`);
 *   await ui.create({ nodes: [{ id: 'card', component: 'WeatherCard', props: { city: input.city } }] });
 *   const forecast = await getForecast(input.city);
 *   await ui.updateProps('card', { forecast });
 *   await ui.setStatus('ready');
 * }
 * ```
 */
export function createGenUIEmitter(
  writer: GenUIChunkWriter | undefined,
  options: GenUIEmitterOptions = {},
): GenUIEmitter {
  const limits = resolveGenUILimits(options.limits);
  const nextEventId = options.generateEventId ?? uuid;

  return {
    surface(surfaceId, surfaceOptions = {}) {
      let revision = surfaceOptions.baseRevision;

      const send = async (operations: GenUIOperation[]): Promise<GenUIEnvelope> => {
        const parsed = parseGenUIOperations(operations, limits);
        if (!parsed.ok) throw new Error(`Invalid GenUI operations for surface "${surfaceId}": ${parsed.error}`);
        const ops = parsed.value;
        const first = ops[0];
        if (first?.op === 'createSurface') {
          if (!first.source && options.source) first.source = { ...options.source };
          revision = 0;
        }
        const envelope: GenUIEnvelope = {
          version: GENUI_PROTOCOL_VERSION,
          eventId: nextEventId(),
          surfaceId,
          ...(revision !== undefined && first?.op !== 'createSurface' ? { baseRevision: revision } : {}),
          operations: ops,
        };
        // Advance before writing so un-awaited consecutive calls get consecutive revisions.
        if (revision !== undefined) revision += 1;
        await writer?.custom({ type: GENUI_DATA_PART_TYPE, data: envelope });
        return envelope;
      };

      return {
        surfaceId,
        send,
        create: (input = {}) => send([{ op: 'createSurface', ...input }]),
        upsertNodes: nodes => send([{ op: 'upsertNodes', nodes }]),
        updateProps: (nodeId, set, unset) => send([{ op: 'updateProps', nodeId, set, ...(unset ? { unset } : {}) }]),
        removeNodes: nodeIds => send([{ op: 'removeNodes', nodeIds }]),
        setChildren: (nodeId, children) => send([{ op: 'setChildren', nodeId, children }]),
        setRoot: rootId => send([{ op: 'setRoot', rootId }]),
        replaceData: data => send([{ op: 'replaceData', data }]),
        patchData: (set, unset) => send([{ op: 'patchData', set, ...(unset ? { unset } : {}) }]),
        setStatus: (status, error) => send([{ op: 'setStatus', status, ...(error !== undefined ? { error } : {}) }]),
        delete: () => send([{ op: 'deleteSurface' }]),
      };
    },
  };
}

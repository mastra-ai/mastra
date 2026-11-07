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

/** The parts of a tool's `execute` context the emitter uses. Pass the whole context. */
export interface GenUIEmitterContext {
  writer?: GenUIChunkWriter;
  agent?: { toolCallId?: string };
}

export interface GenUIEmitterOptions {
  /**
   * Attached to `createSurface` operations that do not set their own `source`. When the emitter is
   * created from a tool's execute context, `toolCallId` defaults to that tool call, so a surface whose
   * tool throws shows as failed.
   */
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
  /**
   * Emit updates for one surface. Omit `surfaceId` to get a unique one, which is what a tool that
   * creates a new surface each time it runs wants. Pass an id only to continue a surface from an
   * earlier run; ids must be unique per thread, since a second `createSurface` with the same id is
   * rejected on the client.
   */
  surface(surfaceId?: string, options?: GenUISurfaceEmitterOptions): GenUISurfaceEmitter;
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
 * Pass the tool's execute context (or just its `writer`). With the context, surfaces are linked to
 * the tool call, so a surface whose tool throws shows as failed. Writes go out in call order, so
 * un-awaited calls are safe.
 *
 * @example
 * ```ts
 * execute: async (input, context) => {
 *   const ui = createGenUIEmitter(context).surface();
 *   await ui.create({ nodes: [{ id: 'card', component: 'WeatherCard', props: { city: input.city } }] });
 *   const forecast = await getForecast(input.city);
 *   await ui.updateProps('card', { forecast });
 *   await ui.setStatus('ready');
 * }
 * ```
 */
export function createGenUIEmitter(
  target: GenUIChunkWriter | GenUIEmitterContext | undefined,
  options: GenUIEmitterOptions = {},
): GenUIEmitter {
  const limits = resolveGenUILimits(options.limits);
  const nextEventId = options.generateEventId ?? uuid;
  const writer = target && 'custom' in target ? target : target?.writer;
  const toolCallId = target && !('custom' in target) ? target.agent?.toolCallId : undefined;
  const source = toolCallId ? { toolCallId, ...options.source } : options.source;

  return {
    surface(surfaceId = uuid(), surfaceOptions = {}) {
      let revision = surfaceOptions.baseRevision;
      let queue: Promise<unknown> = Promise.resolve();

      // Runs after the previous write settles, so each envelope's baseRevision reflects only the
      // envelopes that actually reached the stream.
      const write = async (ops: GenUIOperation[]): Promise<GenUIEnvelope> => {
        const first = ops[0];
        const creates = first?.op === 'createSurface';
        if (creates && !first.source && source) first.source = { ...source };
        const envelope: GenUIEnvelope = {
          version: GENUI_PROTOCOL_VERSION,
          eventId: nextEventId(),
          surfaceId,
          ...(revision !== undefined && !creates ? { baseRevision: revision } : {}),
          operations: ops,
        };
        await writer?.custom({ type: GENUI_DATA_PART_TYPE, data: envelope });
        if (creates) revision = 1;
        else if (revision !== undefined) revision += 1;
        return envelope;
      };

      const send = (operations: GenUIOperation[]): Promise<GenUIEnvelope> => {
        const parsed = parseGenUIOperations(operations, limits);
        if (!parsed.ok) {
          return Promise.reject(new Error(`Invalid GenUI operations for surface "${surfaceId}": ${parsed.error}`));
        }
        const result = queue.then(() => write(parsed.value));
        queue = result.catch(() => undefined);
        return result;
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

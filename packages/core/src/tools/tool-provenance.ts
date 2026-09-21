/**
 * Marks a tool object as a runtime materialization of a processor-managed
 * dynamically loaded tool.
 *
 * Processors such as ToolSearchProcessor keep a catalog of deferred tools and
 * inject the loaded subset into the per-step tool surface. Suspend/resume,
 * tool-surface-fence restore, and durable registry replay can re-expose that
 * loaded executor through the request's own tool map — as a converted
 * `makeCoreTool` copy rather than the catalog instance. The marker lets the
 * owning processor recognize its own re-exposed tool so it is not mistaken for
 * a foreign always-available tool shadowing the loaded name.
 *
 * The marker value is an opaque frozen token, not the source tool. A fenced
 * processor view can read the token, and it must not be able to reach or
 * replace the source executor through it. The marker is enumerable so it
 * survives the `{...tool}` copies used by tool-hook wrap/unwrap; symbols are
 * invisible to `Object.keys`, `JSON.stringify`, and provider serialization.
 */
export const PROCESSOR_LOADED_TOOL_SOURCE: unique symbol = Symbol('mastra.processorLoadedToolSource');

const PROVENANCE_TOKEN: unique symbol = Symbol('mastra.processorLoadedToolToken');
const tokens = new WeakMap<object, object>();

function isToolObject(value: unknown): value is Record<PropertyKey, unknown> {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

function isProvenanceToken(value: unknown): value is object {
  return isToolObject(value) && value[PROVENANCE_TOKEN] === true;
}

function tokenForSource(source: object): object {
  const existing = tokens.get(source);
  if (existing) return existing;
  const carried = isToolObject(source) ? source[PROCESSOR_LOADED_TOOL_SOURCE] : undefined;
  if (isProvenanceToken(carried)) {
    tokens.set(source, carried);
    return carried;
  }
  const token = Object.create(null);
  Object.defineProperty(token, PROVENANCE_TOKEN, { value: true });
  const frozen = Object.freeze(token);
  tokens.set(source, frozen);
  return frozen;
}

function stamp<T>(tool: T, token: object): T {
  if (!isToolObject(tool)) return tool;
  try {
    Object.defineProperty(tool, PROCESSOR_LOADED_TOOL_SOURCE, {
      value: token,
      enumerable: true,
      configurable: true,
      writable: false,
    });
  } catch {
    // Frozen/non-extensible tool objects cannot carry the marker.
  }
  return tool;
}

/**
 * Stamp `tool` as a materialization of `source` — the processor-resolved
 * loaded tool it was converted from. Re-stamping the same object is allowed so
 * shared catalog tools can be marked idempotently. Non-extensible tools simply
 * carry no provenance; consumers must treat an absent marker as foreign.
 */
export function markProcessorLoadedToolSource<T>(tool: T, source: object): T {
  if (!isToolObject(tool)) return tool;
  return stamp(tool, isProvenanceToken(source) ? source : tokenForSource(source));
}

/** Returns the opaque provenance token `tool` carries, if any. */
export function processorLoadedToolSource(tool: unknown): unknown {
  const token = isToolObject(tool) ? tool[PROCESSOR_LOADED_TOOL_SOURCE] : undefined;
  return isProvenanceToken(token) ? token : undefined;
}

/** Copy the loaded-tool provenance marker from `from` onto `to`, if present. */
export function inheritProcessorLoadedToolSource<T>(from: unknown, to: T): T {
  const token = processorLoadedToolSource(from);
  if (isProvenanceToken(token)) {
    stamp(to, token);
  }
  return to;
}

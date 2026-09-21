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
 * The value is the processor-resolved source tool object. The marker is
 * enumerable so it survives the `{...tool}` copies used by tool-hook
 * wrap/unwrap; symbols are invisible to `Object.keys`, `JSON.stringify`, and
 * provider serialization.
 */
export const PROCESSOR_LOADED_TOOL_SOURCE: unique symbol = Symbol('mastra.processorLoadedToolSource');

function isToolObject(value: unknown): value is Record<PropertyKey, unknown> {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

/**
 * Stamp `tool` as a materialization of `source` — the processor-resolved
 * loaded tool it was converted from. Re-stamping the same object is allowed so
 * shared catalog tools can be marked idempotently. Non-extensible tools simply
 * carry no provenance; consumers must treat an absent marker as foreign.
 */
export function markProcessorLoadedToolSource<T>(tool: T, source: object): T {
  if (!isToolObject(tool)) return tool;
  try {
    Object.defineProperty(tool, PROCESSOR_LOADED_TOOL_SOURCE, {
      value: source,
      enumerable: true,
      configurable: true,
      writable: false,
    });
  } catch {
    // Frozen/non-extensible tool objects cannot carry the marker.
  }
  return tool;
}

/** Returns the processor-managed source tool `tool` was materialized from, if any. */
export function processorLoadedToolSource(tool: unknown): unknown {
  return isToolObject(tool) ? tool[PROCESSOR_LOADED_TOOL_SOURCE] : undefined;
}

/** Copy the loaded-tool provenance marker from `from` onto `to`, if present. */
export function inheritProcessorLoadedToolSource<T>(from: unknown, to: T): T {
  const source = processorLoadedToolSource(from);
  if (isToolObject(source)) {
    markProcessorLoadedToolSource(to, source);
  }
  return to;
}

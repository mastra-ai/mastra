import type { Spec, UIElement } from '@json-render/core';
import { validateSpec } from '@json-render/core';
import type { GenUIComponentEntry } from './registry';
import type { NormalizedToolCall } from './tool-parts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The result @mastra/core saves for a tool call cut off by a stopped run (`TOOL_ABORT_NOTICE`, not exported).
 * If core rewords it, stopped specs fall back to showing as ready after a reload.
 */
export const CORE_TOOL_ABORT_NOTICE =
  'Tool execution was aborted while running. The tool may still be running and its effects are unknown. Check its status before retrying.';

const stringList = { type: 'array', items: { type: 'string' } };

const stateRef = (key: '$state' | '$bindState') => ({
  type: 'object',
  properties: { [key]: { type: 'string', description: 'JSON pointer into the spec state' } },
  required: [key],
});

/** Let every top-level prop take a state binding instead of a literal, which closed (strict) schemas otherwise forbid. */
function withStateBindings(props: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(props.properties)) return props;
  return {
    ...props,
    properties: Object.fromEntries(
      Object.entries(props.properties).map(([name, schema]) => [
        name,
        { anyOf: [schema, stateRef('$state'), stateRef('$bindState')] },
      ]),
    ),
  };
}

/**
 * Model-facing input of the spec tool: one complete json-render spec per call. Strict structured-output
 * providers close every object, so anything keyed by the model is reshaped: `elements` and `on` are lists,
 * and the free-form `state` and action `params` are JSON-encoded strings. The parser also accepts the plain
 * json-render forms that non-strict models send. `state` comes first so it is complete before elements render.
 */
export function specToolInputSchema(components: GenUIComponentEntry[]) {
  const element = {
    anyOf: components.map(({ name, propsSchema, events }) => ({
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique id of the element within the spec' },
        type: { type: 'string', enum: [name] },
        props: withStateBindings(propsSchema),
        children: { ...stringList, description: 'Ordered child element ids' },
        ...(events.length
          ? {
              on: {
                type: 'array',
                description: 'Actions to run when the component raises an event',
                items: {
                  type: 'object',
                  properties: {
                    event: { type: 'string', enum: [...events] },
                    action: { type: 'string' },
                    params: {
                      type: 'string',
                      description: 'Action params as a JSON object string, e.g. "{\\"prompt\\": \\"…\\"}"',
                    },
                  },
                  required: ['event', 'action'],
                },
              },
            }
          : {}),
      },
      required: ['id', 'type', 'props'],
    })),
  };
  return {
    type: 'object',
    properties: {
      state: {
        type: 'string',
        description:
          'Initial state as a JSON object string, read by props with {"$state": "/path"} or {"$bindState": "/path"}',
      },
      root: { type: 'string', description: 'Id of the top-level element' },
      elements: { type: 'array', items: element },
    },
    required: ['root', 'elements'],
  };
}

const withoutNulls = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null));

/** A JSON object given as-is or as a JSON string (strict-mode form); anything else reads as `undefined`. */
function readObject(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return isRecord(value) ? value : undefined;
}

type ActionBinding = { action: string; params?: Record<string, unknown> };

/** Event bindings given as json-render's `{event: binding}` map or as the strict-mode `[{event, action, params}]` list. */
function readOn(on: unknown): UIElement['on'] | undefined {
  const bindings: Record<string, ActionBinding[]> = {};
  const add = (event: unknown, binding: unknown) => {
    if (typeof event !== 'string' || !isRecord(binding)) return;
    const { action, params } = withoutNulls(binding);
    if (typeof action !== 'string') return;
    const parsed = readObject(params);
    (bindings[event] ??= []).push(parsed ? { action, params: parsed } : { action });
  };
  if (Array.isArray(on)) {
    for (const entry of on) if (isRecord(entry)) add(entry.event, entry);
  } else if (isRecord(on)) {
    for (const [event, value] of Object.entries(on)) {
      for (const binding of Array.isArray(value) ? value : [value]) add(event, binding);
    }
  }
  const events = Object.entries(bindings);
  if (!events.length) return undefined;
  return Object.fromEntries(
    events.map(([event, list]) => [event, list.length === 1 ? list[0]! : list]),
  ) as UIElement['on'];
}

export type SpecReadResult = { ok: true; spec: Spec } | { ok: false; error: string };

/**
 * Read spec tool arguments into a json-render spec. Strict-mode models send `null` for optional fields they
 * leave out, so those are dropped (props keep theirs for schema validation). Streamed arguments stop anywhere:
 * while `complete` is false the last element may be cut mid-value, so it waits until the next one starts.
 */
export function readSpecToolArgs(args: unknown, complete: boolean): SpecReadResult {
  if (!isRecord(args)) return { ok: false, error: 'arguments must be an object' };
  const input = withoutNulls(args);
  if (!Array.isArray(input.elements)) return { ok: false, error: 'elements must be a list' };
  const items = complete ? input.elements : input.elements.slice(0, -1);
  const elements: Record<string, UIElement> = {};
  for (const item of items) {
    if (!isRecord(item)) return { ok: false, error: 'every element must be an object' };
    const { id, type, props, children, on } = withoutNulls(item);
    if (typeof id !== 'string' || typeof type !== 'string') {
      return { ok: false, error: 'every element needs a string id and type' };
    }
    if (complete && elements[id]) return { ok: false, error: `element id "${id}" is used twice` };
    const element: UIElement = { type, props: isRecord(props) ? props : {} };
    if (Array.isArray(children)) element.children = children.filter(child => typeof child === 'string');
    const bindings = readOn(on);
    if (bindings) element.on = bindings;
    elements[id] = element;
  }
  const root = typeof input.root === 'string' ? input.root : complete ? undefined : Object.keys(elements)[0];
  if (root === undefined) return { ok: false, error: 'root is required' };
  const spec: Spec = { root, elements };
  if (input.state !== undefined) {
    const state = readObject(input.state);
    if (state) spec.state = state;
    else if (complete) return { ok: false, error: 'state must be a JSON object' };
  }
  return { ok: true, spec };
}

/** First structural problem of a complete spec: json-render's own checks, plus cycles. */
export function checkSpecStructure(spec: Spec): string | undefined {
  return validateSpec(spec).issues.find(({ severity }) => severity === 'error')?.message ?? findSpecCycle(spec);
}

/** An element that contains itself, which json-render would render recursively forever. Safe on partial specs. */
export function findSpecCycle(spec: Spec): string | undefined {
  const done = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string): string | undefined => {
    if (done.has(id)) return undefined;
    if (visiting.has(id)) return `element "${id}" contains itself`;
    visiting.add(id);
    for (const child of spec.elements[id]?.children ?? []) {
      const cycle = visit(child);
      if (cycle) return cycle;
    }
    visiting.delete(id);
    done.add(id);
    return undefined;
  };
  for (const id of Object.keys(spec.elements)) {
    const cycle = visit(id);
    if (cycle) return cycle;
  }
  return undefined;
}

/** @experimental Generative UI is in beta and may change without notice. */
export type GenUISpecStatus = 'streaming' | 'ready' | 'invalid' | 'failed' | 'aborted';

/**
 * Status of a spec tool call, from its phase and result. A call left without a result only looks busy
 * while the chat runs; afterwards the run was stopped or ended before it.
 */
export function specStatus(call: NormalizedToolCall, running: boolean): { status: GenUISpecStatus; error?: string } {
  if (call.phase === 'output-error' || call.phase === 'output-denied') {
    return { status: 'failed', ...(call.errorText ? { error: call.errorText } : {}) };
  }
  if (call.phase === 'output-available') {
    if (call.output === CORE_TOOL_ABORT_NOTICE) return { status: 'aborted' };
    if (isRecord(call.output) && call.output.ok === false) {
      return {
        status: 'invalid',
        ...(typeof call.output.error === 'string' ? { error: call.output.error } : {}),
      };
    }
    return { status: 'ready' };
  }
  if (running) return { status: call.phase === 'input-streaming' ? 'streaming' : 'ready' };
  return { status: 'aborted' };
}

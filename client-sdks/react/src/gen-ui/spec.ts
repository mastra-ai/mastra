import type {
  ActionBinding,
  ActionConfirm,
  ActionOnError,
  ActionOnSuccess,
  PropResolutionContext,
  Spec,
  UIElement,
  VisibilityCondition,
} from '@json-render/core';
import { getByPath, resolveRepeatItemStatePath, resolveRepeatStatePath, validateSpec } from '@json-render/core';
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

const ref = (key: string, description: string, type = 'string') => ({
  type: 'object',
  properties: { [key]: { type, description } },
  required: [key],
});

/** Any json-render expression, JSON-encoded so it fits a closed schema. */
const expression = ref(
  '$expr',
  'Any json-render prop expression as a JSON string, e.g. "{\\"$cond\\": {\\"$state\\": \\"/on\\"}, \\"$then\\": \\"Yes\\", \\"$else\\": \\"No\\"}"',
);

/** The expressions a top-level prop can take instead of a literal. */
const propExpressions = [
  ref('$state', 'JSON pointer into the spec state'),
  ref('$bindState', 'JSON pointer into the spec state, written back when the component changes it'),
  ref('$item', 'Field of the current repeat item ("" for the item itself)'),
  ref('$bindItem', 'Field of the current repeat item, written back when the component changes it'),
  ref('$index', 'true, for the index of the current repeat item', 'boolean'),
  ref('$template', 'String with ${/path} state references and ${field} repeat-item references'),
  expression,
];

/** Let a value be an expression at any depth; closed (strict) schemas otherwise only allow literals. */
function withExpressions(schema: unknown, alternatives: unknown[]): unknown {
  return { anyOf: [withNestedExpressions(schema), ...alternatives] };
}

function withNestedExpressions(schema: unknown): unknown {
  if (!isRecord(schema)) return schema;
  const result: Record<string, unknown> = { ...schema };
  if (isRecord(schema.properties)) {
    result.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([name, value]) => [name, withExpressions(value, [expression])]),
    );
  }
  if (isRecord(schema.items)) result.items = withExpressions(schema.items, [expression]);
  if (Array.isArray(schema.anyOf)) result.anyOf = schema.anyOf.map(withNestedExpressions);
  return result;
}

function propsWithExpressions(props: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(props.properties)) return props;
  return {
    ...props,
    properties: Object.fromEntries(
      Object.entries(props.properties).map(([name, schema]) => [name, withExpressions(schema, propExpressions)]),
    ),
  };
}

const jsonString = (description: string) => ({ type: 'string', description });

/** An action binding, keyed by `key` (an event or a state path) since strict schemas cannot key maps. */
const bindingList = (key: Record<string, unknown>, description: string) => ({
  type: 'array',
  description,
  items: {
    type: 'object',
    properties: {
      ...key,
      action: { type: 'string', description: 'Built-in or app action name' },
      params: jsonString('Action params as a JSON object string; values may be expressions like {"$state": "/path"}'),
      confirm: {
        type: 'object',
        description: 'Ask the user before running the action',
        properties: {
          title: { type: 'string' },
          message: { type: 'string' },
          confirmLabel: { type: 'string' },
          cancelLabel: { type: 'string' },
          variant: { type: 'string', enum: ['default', 'danger'] },
        },
        required: ['title', 'message'],
      },
      onSuccess: jsonString(
        'After the action succeeds, as a JSON string: {"set": {"/path": value}}, {"action": "name"} or {"navigate": "/screen"}',
      ),
      onError: jsonString('After the action fails, as a JSON string: {"set": {"/path": value}} or {"action": "name"}'),
      preventDefault: { type: 'boolean' },
    },
    required: [...Object.keys(key), 'action'],
  },
});

/**
 * Model-facing input of the spec tool: one complete json-render spec per call, with every element feature.
 * Strict structured-output providers close every object, so anything keyed by the model is reshaped: `elements`,
 * `slots`, `on` and `watch` are lists; free-form values (`state`, `visible`, action `params`, `onSuccess`,
 * `onError`) are JSON-encoded strings; and props take expressions through explicit branches, or `$expr`. The
 * parser also accepts the plain json-render forms that non-strict models send. `state` comes first so it is
 * complete before elements render.
 */
export function specToolInputSchema(components: GenUIComponentEntry[]) {
  const element = {
    anyOf: components.map(({ name, propsSchema, events, slots }) => ({
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique id of the element within the spec' },
        type: { type: 'string', enum: [name] },
        props: propsWithExpressions(propsSchema),
        children: { ...stringList, description: 'Ordered child element ids (rendered once per item under `repeat`)' },
        ...(slots.length
          ? {
              slots: {
                type: 'array',
                description: 'Child element ids for named slots, besides `children`',
                items: {
                  type: 'object',
                  properties: { name: { type: 'string', enum: [...slots] }, children: stringList },
                  required: ['name', 'children'],
                },
              },
            }
          : {}),
        visible: jsonString(
          'Show the element only when this json-render condition holds, as a JSON string, e.g. "{\\"$state\\": \\"/tab\\", \\"eq\\": \\"home\\"}"',
        ),
        repeat: {
          type: 'object',
          description: 'Render `children` once per item of a state array',
          properties: {
            statePath: {
              anyOf: [
                { type: 'string', description: 'JSON pointer to the array' },
                ref('$item', 'Field of the enclosing repeat item holding the array'),
              ],
            },
            key: { type: 'string', description: 'Item field that identifies each item' },
          },
          required: ['statePath'],
        },
        ...(events.length
          ? {
              on: bindingList(
                { event: { type: 'string', enum: [...events] } },
                'Actions to run when the component raises an event',
              ),
            }
          : {}),
        watch: bindingList(
          { statePath: { type: 'string', description: 'JSON pointer to watch' } },
          'Actions to run when a state value changes',
        ),
      },
      required: ['id', 'type', 'props'],
    })),
  };
  return {
    type: 'object',
    properties: {
      state: jsonString('Initial state as a JSON object string, read and written by expressions and actions'),
      root: { type: 'string', description: 'Id of the top-level element' },
      elements: { type: 'array', items: element },
    },
    required: ['root', 'elements'],
  };
}

const withoutNulls = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null));

/** A JSON value given as-is or JSON-encoded in a string, the strict-mode form of free-form fields. */
function readJSON(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function readObject(value: unknown): Record<string, unknown> | undefined {
  const parsed = readJSON(value);
  return isRecord(parsed) ? parsed : undefined;
}

/** Replace every `{"$expr": "<json>"}` (how strict-mode models write an arbitrary expression) by the expression. */
function decodeExpressions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeExpressions);
  if (!isRecord(value)) return value;
  const keys = Object.keys(value).filter(key => value[key] !== null);
  if (keys.length === 1 && keys[0] === '$expr' && typeof value.$expr === 'string') return readJSON(value.$expr);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeExpressions(item)]));
}

function readBinding(raw: unknown): ActionBinding | undefined {
  if (!isRecord(raw)) return undefined;
  const { action, params, confirm, onSuccess, onError, preventDefault } = withoutNulls(raw);
  if (typeof action !== 'string') return undefined;
  const binding: ActionBinding = { action };
  const parsedParams = readObject(params);
  if (parsedParams) binding.params = parsedParams as ActionBinding['params'];
  if (isRecord(confirm)) binding.confirm = withoutNulls(confirm) as unknown as ActionConfirm;
  const success = readObject(onSuccess);
  if (success) binding.onSuccess = success as ActionOnSuccess;
  const error = readObject(onError);
  if (error) binding.onError = error as ActionOnError;
  if (typeof preventDefault === 'boolean') binding.preventDefault = preventDefault;
  return binding;
}

type Bindings = Record<string, ActionBinding | ActionBinding[]>;

/**
 * Action bindings keyed by event (`on`) or state path (`watch`), given as json-render's map or as the
 * strict-mode list of `{[key], action, …}` entries.
 */
function readBindings(value: unknown, key: 'event' | 'statePath'): Bindings | undefined {
  const bindings: Record<string, ActionBinding[]> = {};
  const add = (name: unknown, raw: unknown) => {
    const binding = typeof name === 'string' ? readBinding(raw) : undefined;
    if (binding) (bindings[name as string] ??= []).push(binding);
  };
  if (Array.isArray(value)) {
    for (const entry of value) if (isRecord(entry)) add(entry[key], entry);
  } else if (isRecord(value)) {
    for (const [name, entry] of Object.entries(value)) {
      for (const raw of Array.isArray(entry) ? entry : [entry]) add(name, raw);
    }
  }
  const entries = Object.entries(bindings);
  if (!entries.length) return undefined;
  return Object.fromEntries(entries.map(([name, list]) => [name, list.length === 1 ? list[0]! : list]));
}

const childIds = (value: unknown) =>
  Array.isArray(value) ? value.filter((child): child is string => typeof child === 'string') : undefined;

/** Named child lists, as json-render's `{name: ids}` map or the strict-mode `[{name, children}]` list. */
function readSlots(value: unknown): Record<string, string[]> | undefined {
  const entries: [unknown, unknown][] = Array.isArray(value)
    ? value.filter(isRecord).map(entry => [entry.name, entry.children])
    : isRecord(value)
      ? Object.entries(value)
      : [];
  const slots: Record<string, string[]> = {};
  for (const [name, children] of entries) {
    const ids = childIds(children);
    if (typeof name === 'string' && ids) slots[name] = ids;
  }
  return Object.keys(slots).length ? slots : undefined;
}

function readRepeat(value: unknown): UIElement['repeat'] | undefined {
  if (!isRecord(value)) return undefined;
  const { statePath, key } = withoutNulls(value);
  const path =
    typeof statePath === 'string'
      ? statePath
      : isRecord(statePath) && typeof statePath.$item === 'string'
        ? { $item: statePath.$item }
        : undefined;
  if (path === undefined) return undefined;
  return typeof key === 'string' ? { statePath: path, key } : { statePath: path };
}

function readElement(item: Record<string, unknown>, type: string): UIElement {
  const { props, children, slots, visible, repeat, on, watch } = withoutNulls(item);
  const element: UIElement = {
    type,
    props: isRecord(props) ? (decodeExpressions(props) as Record<string, unknown>) : {},
  };
  const ids = childIds(children);
  if (ids) element.children = ids;
  const named = readSlots(slots);
  if (named) element.slots = named;
  const condition = readJSON(visible);
  if (condition !== undefined) element.visible = condition as VisibilityCondition;
  const repeated = readRepeat(repeat);
  if (repeated) element.repeat = repeated;
  const events = readBindings(on, 'event');
  if (events) element.on = events;
  const watchers = readBindings(watch, 'statePath');
  if (watchers) element.watch = watchers;
  return element;
}

export type SpecReadResult = { ok: true; spec: Spec } | { ok: false; error: string };

/**
 * Read spec tool arguments into a json-render spec. Every json-render element field is kept; strict-mode
 * models send `null` for optional fields they leave out, so those are dropped (props keep theirs for schema
 * validation), and their list and JSON-string forms are turned back into json-render's. `elements` may be a
 * list of elements with an `id` or json-render's map. Streamed arguments stop anywhere: while `complete` is
 * false the last element may be cut mid-value, so it waits until the next one starts.
 */
export function readSpecToolArgs(args: unknown, complete: boolean): SpecReadResult {
  if (!isRecord(args)) return { ok: false, error: 'arguments must be an object' };
  const input = withoutNulls(args);
  const listed: unknown[] | undefined = Array.isArray(input.elements)
    ? input.elements
    : isRecord(input.elements)
      ? Object.entries(input.elements).map(([id, element]) => (isRecord(element) ? { ...element, id } : element))
      : undefined;
  if (!listed) return { ok: false, error: 'elements must be a list or a map of elements by id' };
  const items = complete ? listed : listed.slice(0, -1);
  const elements: Record<string, UIElement> = {};
  for (const item of items) {
    if (!isRecord(item)) return { ok: false, error: 'every element must be an object' };
    const { id, type } = item;
    if (typeof id !== 'string' || typeof type !== 'string') {
      return { ok: false, error: 'every element needs a string id and type' };
    }
    if (complete && elements[id]) return { ok: false, error: `element id "${id}" is used twice` };
    elements[id] = readElement(item, type);
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

/**
 * The context each element's props resolve in, so they can be checked before rendering: elements inside a
 * `repeat` read its first item. `null` marks elements whose repeat has no items yet, so nothing to check.
 */
export function propContexts(spec: Spec, base: PropResolutionContext): Map<string, PropResolutionContext | null> {
  const contexts = new Map<string, PropResolutionContext | null>();
  const visit = (id: string, context: PropResolutionContext | null) => {
    const element = spec.elements[id];
    if (!element || contexts.has(id)) return;
    contexts.set(id, context);
    let inner = context;
    if (element.repeat && context) {
      const path = resolveRepeatStatePath(element.repeat.statePath, context.repeatBasePath);
      const items = path === undefined ? undefined : getByPath(context.stateModel, path);
      inner =
        path !== undefined && Array.isArray(items) && items.length
          ? { ...context, repeatItem: items[0], repeatIndex: 0, repeatBasePath: resolveRepeatItemStatePath(path, 0) }
          : null;
    }
    for (const child of childrenOf(element)) visit(child, inner);
  };
  visit(spec.root, base);
  for (const id of Object.keys(spec.elements)) visit(id, base);
  return contexts;
}

/** Ids an element renders: its children, then every slot's. */
export const childrenOf = (element: UIElement | undefined): string[] => [
  ...(element?.children ?? []),
  ...Object.values(element?.slots ?? {}).flat(),
];

/** An element that contains itself, which json-render would render recursively forever. Safe on partial specs. */
export function findSpecCycle(spec: Spec): string | undefined {
  const done = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string): string | undefined => {
    if (done.has(id)) return undefined;
    if (visiting.has(id)) return `element "${id}" contains itself`;
    visiting.add(id);
    for (const child of childrenOf(spec.elements[id])) {
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

import { createStateStore } from '@json-render/core';
import type { Spec, StateModel, StateStore } from '@json-render/core';
import { flattenToPointers } from '@json-render/core/store-utils';
import { JSONUIProvider, Renderer } from '@json-render/react';
import type { ComponentRegistry, ComponentRenderProps } from '@json-render/react';
import { specStatus } from '@mastra/client-js/gen-ui';
import type { GenUISpecStatus, NormalizedToolCall } from '@mastra/client-js/gen-ui';
import { Component, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useGenUIController } from './context';
import type { GenUIFallbackProps, GenUIFallbacks, GenUIRegistry, GenUISpecStatusProps } from './registry';

/** @experimental Generative UI is in beta and may change without notice. */
export function DefaultGenUIFallback({ reason }: GenUIFallbackProps) {
  return (
    <div role="note" data-genui-fallback="">
      {reason}
    </div>
  );
}

/** @experimental Generative UI is in beta and may change without notice. */
export function DefaultGenUILoading() {
  return (
    <div role="status" data-genui-loading="">
      Loading…
    </div>
  );
}

/** @experimental Generative UI is in beta and may change without notice. */
export function DefaultGenUISpecStatus({ status, error }: GenUISpecStatusProps) {
  if (status === 'streaming') return null;
  if (status === 'failed') {
    return (
      <div role="alert" data-genui-spec-status="failed">
        {error ?? 'This interface failed to load.'}
      </div>
    );
  }
  return (
    <div role="note" data-genui-spec-status="aborted">
      {error ?? 'This interface was interrupted before it finished.'}
    </div>
  );
}

export function resolveFallbacks(fallbacks: GenUIFallbacks) {
  return {
    Fallback: fallbacks.Fallback ?? DefaultGenUIFallback,
    Loading: fallbacks.Loading ?? DefaultGenUILoading,
    SpecStatus: fallbacks.SpecStatus ?? DefaultGenUISpecStatus,
  };
}

interface BoundaryProps {
  resetKey: unknown;
  fallback: (error: Error) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  children?: ReactNode;
}

interface BoundaryState {
  error?: Error;
  resetKey: unknown;
}

/**
 * Contains render errors thrown by a registered component so the rest of the message keeps rendering.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export class GenUIErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): Partial<BoundaryState> | null {
    // New props from the agent get another chance to render. React's API uses `null` for "no change".
    if (props.resetKey !== state.resetKey) return { error: undefined, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}

/**
 * Validates an element's resolved props against its catalog schema before json-render renders the app's
 * component, and contains render errors, so one bad element never blanks the spec. json-render itself
 * does not validate props.
 */
export function ElementView(props: ComponentRenderProps) {
  const { element, loading } = props;
  const controller = useGenUIController();
  const { Fallback, Loading } = resolveFallbacks(controller.registry.fallbacks);
  const Rendered = controller.registry.registry[element.type];
  const validation = controller.validateProps(element.type, element.props);
  if (!Rendered || !validation) {
    return (
      <Fallback
        kind="unknown-component"
        component={element.type}
        reason={`The component "${element.type}" is not available in this app.`}
      />
    );
  }
  if (!validation.ok) {
    if (loading) return <Loading component={element.type} />;
    return (
      <Fallback
        kind="invalid-props"
        component={element.type}
        reason={`"${element.type}" received invalid data: ${validation.error}`}
      />
    );
  }
  return (
    <GenUIErrorBoundary
      resetKey={element.props}
      fallback={() => (
        <Fallback kind="render-error" component={element.type} reason={`"${element.type}" could not be displayed.`} />
      )}
    >
      <Rendered {...props} element={{ ...element, props: validation.value as Record<string, unknown> }} />
    </GenUIErrorBoundary>
  );
}

/** Specs may only use declarative components; every one renders through `ElementView`. */
const specRegistries = new WeakMap<GenUIRegistry, ComponentRegistry>();
function specRegistry(registry: GenUIRegistry): ComponentRegistry {
  let result = specRegistries.get(registry);
  if (!result) {
    result = Object.fromEntries(
      Object.values(registry.components)
        .filter(entry => entry.declarative)
        .map(entry => [entry.name, ElementView]),
    );
    specRegistries.set(registry, result);
  }
  return result;
}

function useRunning() {
  const controller = useGenUIController();
  return useSyncExternalStore(controller.subscribe, controller.isRunning, controller.isRunning);
}

/**
 * Keep the spec's json-render state in step with the agent's: values the agent changes are written to the
 * store, every other path keeps what the user set. The store outlives the streamed arguments, so state the
 * model writes early is not reset as the rest of the spec arrives.
 */
function useSpecStore(agentState: StateModel | undefined): StateStore {
  const [store] = useState(() => createStateStore(agentState ?? {}));
  const applied = useRef(agentState ?? {});
  const key = JSON.stringify(agentState ?? {});
  useLayoutEffect(() => {
    const next = flattenToPointers(JSON.parse(key) as StateModel);
    const previous = flattenToPointers(applied.current);
    const changed = Object.fromEntries(
      Object.entries(next).filter(([path, value]) => JSON.stringify(previous[path]) !== JSON.stringify(value)),
    );
    applied.current = JSON.parse(key) as StateModel;
    if (Object.keys(changed).length) store.update(changed);
  }, [key, store]);
  return store;
}

/** A spec cut off mid-stream still names children the model never wrote; drop those references. */
function withoutMissingChildren(spec: Spec): Spec {
  const present = (ids: string[]) => ids.filter(child => Object.hasOwn(spec.elements, child));
  const elements: Spec['elements'] = {};
  for (const [id, element] of Object.entries(spec.elements)) {
    const pruned = { ...element };
    if (element.children) pruned.children = present(element.children);
    if (element.slots) {
      pruned.slots = Object.fromEntries(Object.entries(element.slots).map(([name, ids]) => [name, present(ids)]));
    }
    elements[id] = pruned;
  }
  return { ...spec, elements };
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUISpecViewProps {
  call: NormalizedToolCall;
  className?: string;
}

interface SpecFrameProps {
  /** The tool call or message the spec belongs to; its actions run in its name. */
  id: string;
  status: GenUISpecStatus;
  statusError?: string;
  spec?: Spec;
  error?: string;
  className?: string;
}

/** Draws one spec with its own json-render state and actions, whichever part of a message it came from. */
function SpecFrame({ id, status, statusError, spec: read, error: readError, className }: SpecFrameProps) {
  const controller = useGenUIController();
  const spec = read && status !== 'streaming' ? withoutMissingChildren(read) : read;
  const store = useSpecStore(spec?.state);
  useLayoutEffect(() => controller.trackStore(id, store), [controller, id, store]);
  const statusRef = useRef<GenUISpecStatus>(status);
  useLayoutEffect(() => {
    statusRef.current = status;
  }, [status]);
  const handlers = useMemo(
    () => controller.actionHandlers({ toolCallId: id, store, isReady: () => statusRef.current === 'ready' }),
    [controller, id, store],
  );
  const { Fallback, Loading, SpecStatus } = resolveFallbacks(controller.registry.fallbacks);
  const registry = specRegistry(controller.registry);

  const invalid = status === 'invalid' ? (statusError ?? 'invalid spec') : status !== 'streaming' && readError;
  if (invalid) return <Fallback kind="invalid-spec" reason={`This interface could not be displayed: ${invalid}`} />;
  return (
    <div
      className={className}
      data-genui-spec={id}
      data-genui-status={status}
      aria-busy={status === 'streaming' || undefined}
    >
      {spec?.elements[spec.root] ? (
        <JSONUIProvider
          registry={registry}
          store={store}
          handlers={handlers}
          navigate={controller.navigate}
          functions={controller.registry.functions}
          validationFunctions={controller.registry.validationFunctions}
          directives={controller.registry.directives}
        >
          <Renderer spec={spec} registry={registry} loading={status === 'streaming'} fallback={ElementView} />
        </JSONUIProvider>
      ) : status === 'streaming' ? (
        <Loading />
      ) : null}
      {status === 'streaming' || status === 'failed' || status === 'aborted' ? (
        <SpecStatus status={status} error={statusError} />
      ) : null}
    </div>
  );
}

/**
 * The json-render spec of one spec or edit tool call, drawn where the call appears in the message. It renders
 * progressively while the model writes it; its state and actions are local to this call. An edit renders its
 * target with the edit applied, starting from the state the user had set in the target.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function GenUISpecView({ call, className }: GenUISpecViewProps) {
  const controller = useGenUIController();
  const running = useRunning();
  const { status, error: statusError } = specStatus(call, running);
  useSyncExternalStore(controller.subscribeSpecs, controller.specsVersion, controller.specsVersion);
  const { spec, error } = controller.readSpecCall(call);
  return (
    <SpecFrame
      id={call.toolCallId}
      status={status}
      statusError={statusError}
      spec={spec}
      error={error}
      className={className}
    />
  );
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIDataSpecViewProps {
  /** A json-render `data-spec` part of an assistant message. */
  part: object;
  className?: string;
}

/**
 * The spec json-render `data-spec` parts build (from `pipeJsonRender` or a tool writing to the stream), drawn
 * once per message at its first such part. It renders progressively while the message streams; its state and
 * actions are local to the message.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function GenUIDataSpecView({ part, className }: GenUIDataSpecViewProps) {
  const controller = useGenUIController();
  const running = useRunning();
  useSyncExternalStore(controller.subscribeSpecs, controller.specsVersion, controller.specsVersion);
  const messageId = controller.dataSpecOf(part);
  const read = messageId ? controller.readDataSpec(messageId) : undefined;
  const streaming = running && !!read?.live;
  const problem = useMemo(
    () => (read?.spec && !streaming && !read.error ? controller.checkSpec(read.spec) : undefined),
    [controller, read, streaming],
  );
  if (!messageId || !read) return null;
  return (
    <SpecFrame
      id={messageId}
      status={streaming ? 'streaming' : 'ready'}
      spec={read.spec}
      error={read.error ?? problem}
      className={className}
    />
  );
}

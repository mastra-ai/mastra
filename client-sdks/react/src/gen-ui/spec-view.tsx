import { createStateStore } from '@json-render/core';
import type { Spec, StateModel, StateStore } from '@json-render/core';
import { flattenToPointers } from '@json-render/core/store-utils';
import { JSONUIProvider, Renderer } from '@json-render/react';
import type { ComponentRegistry, ComponentRenderProps } from '@json-render/react';
import { Component, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useGenUIController } from './context';
import type { GenUIFallbackProps, GenUIFallbacks, GenUIRegistry, GenUISpecStatusProps } from './registry';
import { findSpecCycle, readSpecToolArgs, specStatus } from './spec';
import type { GenUISpecStatus } from './spec';
import { partialArgsOf } from './tool-parts';
import type { NormalizedToolCall } from './tool-parts';

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

function readCall(call: NormalizedToolCall): { spec?: Spec; error?: string } {
  const args = partialArgsOf(call);
  if (!args) return {};
  const read = readSpecToolArgs(args, call.phase !== 'input-streaming');
  if (!read.ok) return { error: read.error };
  const cycle = findSpecCycle(read.spec);
  return cycle ? { error: cycle } : { spec: read.spec };
}

/** A spec cut off mid-stream still names children the model never wrote; drop those references. */
function withoutMissingChildren(spec: Spec): Spec {
  const elements: Spec['elements'] = {};
  for (const [id, element] of Object.entries(spec.elements)) {
    elements[id] = element.children
      ? { ...element, children: element.children.filter(child => Object.hasOwn(spec.elements, child)) }
      : element;
  }
  return { ...spec, elements };
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUISpecViewProps {
  call: NormalizedToolCall;
  className?: string;
}

/**
 * The json-render spec of one spec tool call, drawn where the call appears in the message. It renders
 * progressively while the model writes it; its state and actions are local to this call.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function GenUISpecView({ call, className }: GenUISpecViewProps) {
  const controller = useGenUIController();
  const running = useRunning();
  const { status, error: statusError } = specStatus(call, running);
  const { spec: read, error: readError } = readCall(call);
  const spec = read && status !== 'streaming' ? withoutMissingChildren(read) : read;
  const store = useSpecStore(spec?.state);
  const statusRef = useRef<GenUISpecStatus>(status);
  useLayoutEffect(() => {
    statusRef.current = status;
  }, [status]);
  const handlers = useMemo(
    () =>
      controller.actionHandlers({
        toolCallId: call.toolCallId,
        store,
        isReady: () => statusRef.current === 'ready',
      }),
    [controller, call.toolCallId, store],
  );
  const { Fallback, Loading, SpecStatus } = resolveFallbacks(controller.registry.fallbacks);
  const registry = specRegistry(controller.registry);

  const invalid = status === 'invalid' ? (statusError ?? 'invalid spec') : status !== 'streaming' && readError;
  if (invalid) return <Fallback kind="invalid-spec" reason={`This interface could not be displayed: ${invalid}`} />;
  return (
    <div
      className={className}
      data-genui-spec={call.toolCallId}
      data-genui-status={status}
      aria-busy={status === 'streaming' || undefined}
    >
      {spec?.elements[spec.root] ? (
        <JSONUIProvider registry={registry} store={store} handlers={handlers}>
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

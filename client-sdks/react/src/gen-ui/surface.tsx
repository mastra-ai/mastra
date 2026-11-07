import { JSONUIProvider, Renderer } from '@json-render/react';
import type { ComponentRegistry, ComponentRenderProps } from '@json-render/react';
import { toSafeJSONValue } from '@mastra/client-js/gen-ui';
import type { GenUISurface } from '@mastra/client-js/gen-ui';
import { Component, createContext, useMemo, useState, useSyncExternalStore } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { SurfaceScopeContext, useGenUIController, useGenUISurface } from './context';
import type { GenUIController } from './controller';
import { isCatalogCompatible } from './registry';
import type { GenUIFallbackProps, GenUIFallbacks, GenUIRegistry, GenUISurfaceStatusProps } from './registry';
import { createGenUISurfaceStore } from './surface-store';

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
export function DefaultGenUISurfaceStatus({ status, error }: GenUISurfaceStatusProps) {
  if (status === 'streaming') return null;
  if (status === 'failed') {
    return (
      <div role="alert" data-genui-surface-status="failed">
        {error ?? 'This interface failed to load.'}
      </div>
    );
  }
  return (
    <div role="note" data-genui-surface-status="aborted">
      {error ?? 'This interface was interrupted before it finished.'}
    </div>
  );
}

export function resolveFallbacks(fallbacks: GenUIFallbacks) {
  return {
    Fallback: fallbacks.Fallback ?? DefaultGenUIFallback,
    Loading: fallbacks.Loading ?? DefaultGenUILoading,
    SurfaceStatus: fallbacks.SurfaceStatus ?? DefaultGenUISurfaceStatus,
  };
}

interface BoundaryProps {
  resetKey: unknown;
  fallback: (error: Error) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  children?: ReactNode;
}

/** Contains render errors thrown by a registered component so the rest of the message keeps rendering. */
interface BoundaryState {
  error?: Error;
  resetKey: unknown;
}

/** @experimental Generative UI is in beta and may change without notice. */
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

function useSurfaceStatus(surfaceId: string): GenUISurface['status'] | undefined {
  const controller = useGenUIController();
  const get = () => controller.getSurfaceStatus(surfaceId);
  return useSyncExternalStore(controller.subscribe, get, get);
}

function useSurfaceError(surfaceId: string): string | undefined {
  const controller = useGenUIController();
  const get = () => controller.getSurfaceError(surfaceId);
  return useSyncExternalStore(controller.subscribe, get, get);
}

/**
 * Adapts a registered component to json-render's component contract: validates the resolved props
 * against the component schema and contains render errors, so one bad element never blanks the surface.
 */
function ElementView({ element, children, emit, bindings, loading }: ComponentRenderProps) {
  const controller = useGenUIController();
  const { Fallback, Loading } = resolveFallbacks(controller.registry.fallbacks);
  const entry = controller.registry.components[element.type];
  const validation = controller.validateElementProps(element.type, element.props);
  if (!entry || !validation) {
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
  const Rendered = entry.definition.component;
  return (
    <GenUIErrorBoundary
      resetKey={element.props}
      fallback={() => (
        <Fallback kind="render-error" component={element.type} reason={`"${element.type}" could not be displayed.`} />
      )}
    >
      <Rendered props={validation.value} emit={emit} bindings={bindings} loading={loading}>
        {children}
      </Rendered>
    </GenUIErrorBoundary>
  );
}

const jsonRenderRegistries = new WeakMap<GenUIRegistry, ComponentRegistry>();
function toJsonRenderRegistry(registry: GenUIRegistry): ComponentRegistry {
  let result = jsonRenderRegistries.get(registry);
  if (!result) {
    result = Object.fromEntries(
      Object.entries(registry.components)
        .filter(([, entry]) => entry.definition.declarative !== false)
        .map(([name]) => [name, ElementView]),
    );
    jsonRenderRegistries.set(registry, result);
  }
  return result;
}

/** Spec actions that are not json-render built-ins go through the controller's action dispatcher. */
function createActionHandlers(controller: GenUIController, surfaceId: string) {
  const handler = (name: string) => async (params: Record<string, unknown>) =>
    controller.actions.dispatch({ surfaceId, name, payload: toSafeJSONValue(params ?? {}, Infinity, 'params') });
  // Handlers are read once when the surface mounts, while the app's actions can change later.
  return new Proxy({} as Record<string, ReturnType<typeof handler>>, {
    get: (_target, name) => (typeof name === 'string' ? handler(name) : undefined),
  });
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUISurfaceViewProps {
  surfaceId: string;
  className?: string;
}

/**
 * Render one declarative surface from the controller in context.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function GenUISurfaceView({ surfaceId, className }: GenUISurfaceViewProps) {
  return <SurfaceFrame surfaceId={surfaceId} className={className} />;
}

/**
 * Renders the controller's surface, or `preview` while the model is still writing it. Both share
 * this component so the switch from preview to the real surface keeps every mounted component.
 */
export function SurfaceFrame({ surfaceId, preview, className }: GenUISurfaceViewProps & { preview?: GenUISurface }) {
  const controller = useGenUIController();
  const liveSurface = useGenUISurface(surfaceId);
  const liveStatus = useSurfaceStatus(surfaceId);
  const liveError = useSurfaceError(surfaceId);
  const surface = preview ?? liveSurface;
  const status = preview ? preview.status : liveStatus;
  const error = preview ? preview.error : liveError;
  const { Fallback, Loading, SurfaceStatus } = resolveFallbacks(controller.registry.fallbacks);
  // One store per surface id: the preview and the live surface share it, so the swap keeps bound state.
  const [store] = useState(() => createGenUISurfaceStore(controller.state, surfaceId, controller.subscribe));
  const [handlers] = useState(() => createActionHandlers(controller, surfaceId));
  const scope = useMemo(() => ({ surfaceId, store }), [surfaceId, store]);
  const registry = toJsonRenderRegistry(controller.registry);
  store.setAgentState(surface?.spec.state);
  if (!surface) return <Loading />;
  if (!isCatalogCompatible(controller.registry, surface)) {
    return (
      <Fallback
        kind="incompatible-catalog"
        reason={`This interface was made for a different version of the app (${surface.catalogId}@${surface.catalogVersion ?? '?'}).`}
      />
    );
  }
  return (
    <div
      className={className}
      data-genui-surface={surface.id}
      data-genui-status={status}
      aria-busy={status === 'streaming' || undefined}
      aria-label={surface.title}
      role={surface.title ? 'group' : undefined}
    >
      {surface.spec.elements[surface.spec.root] ? (
        <SurfaceScopeContext.Provider value={scope}>
          <JSONUIProvider registry={registry} store={store} handlers={handlers}>
            <Renderer spec={surface.spec} registry={registry} loading={status === 'streaming'} fallback={ElementView} />
          </JSONUIProvider>
        </SurfaceScopeContext.Provider>
      ) : status === 'streaming' ? (
        <Loading />
      ) : null}
      {status === 'streaming' || status === 'failed' || status === 'aborted' ? (
        <SurfaceStatus status={status} error={error} />
      ) : null}
    </div>
  );
}

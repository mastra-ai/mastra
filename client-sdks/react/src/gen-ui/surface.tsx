import { resolveGenUILimits } from '@mastra/client-js/gen-ui';
import type { GenUISurface } from '@mastra/client-js/gen-ui';
import { Component, memo, useSyncExternalStore } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { GenUINodeScope, useGenUIController, useGenUINode, useGenUISurface } from './context';
import { isCatalogCompatible } from './registry';
import type { GenUIFallbackProps, GenUIFallbacks, GenUISurfaceStatusProps } from './registry';

export function DefaultGenUIFallback({ reason }: GenUIFallbackProps) {
  return (
    <div role="note" data-genui-fallback="">
      {reason}
    </div>
  );
}

export function DefaultGenUILoading() {
  return (
    <div role="status" data-genui-loading="">
      Loading…
    </div>
  );
}

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

interface NodeViewProps {
  surfaceId: string;
  nodeId: string;
  depth: number;
}

const NodeView = memo(function NodeView({ surfaceId, nodeId, depth }: NodeViewProps) {
  const controller = useGenUIController();
  const node = useGenUINode(surfaceId, nodeId);
  const status = useSurfaceStatus(surfaceId);
  const { Fallback, Loading } = resolveFallbacks(controller.registry.fallbacks);
  const streaming = status === 'streaming';

  if (depth > resolveGenUILimits(controller.registry.limits).maxTreeDepth) {
    return <Fallback kind="invalid-surface" reason="This interface is nested too deeply to display." />;
  }
  if (!node) {
    // Children may reference nodes that have not streamed in yet.
    return streaming ? <Loading /> : null;
  }
  const entry = controller.registry.components[node.component];
  const validation = controller.validateNodeProps(node);
  if (!entry || !validation) {
    return (
      <Fallback
        kind="unknown-component"
        component={node.component}
        reason={`The component "${node.component}" is not available in this app.`}
      />
    );
  }
  if (!validation.ok) {
    if (streaming) return <Loading component={node.component} />;
    return (
      <Fallback
        kind="invalid-props"
        component={node.component}
        reason={`"${node.component}" received invalid data: ${validation.error}`}
      />
    );
  }

  const seen = new Set<string>();
  const children = node.children.length
    ? node.children.map((childId, index) => {
        const key = seen.has(childId) ? `${childId}#${index}` : childId;
        seen.add(childId);
        return <NodeView key={key} surfaceId={surfaceId} nodeId={childId} depth={depth + 1} />;
      })
    : undefined;
  const Rendered = entry.definition.component;

  return (
    <GenUINodeScope surfaceId={surfaceId} nodeId={nodeId}>
      <GenUIErrorBoundary
        resetKey={node}
        fallback={() => (
          <Fallback
            kind="render-error"
            component={node.component}
            reason={`"${node.component}" could not be displayed.`}
          />
        )}
      >
        <Rendered props={validation.value}>{children}</Rendered>
      </GenUIErrorBoundary>
    </GenUINodeScope>
  );
});

export interface GenUISurfaceViewProps {
  surfaceId: string;
  className?: string;
}

/** Render one declarative surface from the controller in context. */
export function GenUISurfaceView({ surfaceId, className }: GenUISurfaceViewProps) {
  const controller = useGenUIController();
  const surface = useGenUISurface(surfaceId);
  const status = useSurfaceStatus(surfaceId);
  const { Fallback, Loading, SurfaceStatus } = resolveFallbacks(controller.registry.fallbacks);
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
      {surface.rootId ? (
        <NodeView surfaceId={surface.id} nodeId={surface.rootId} depth={1} />
      ) : status === 'streaming' ? (
        <Loading />
      ) : null}
      {status === 'streaming' || status === 'failed' || status === 'aborted' ? (
        <SurfaceStatus status={status} error={surface.error} />
      ) : null}
    </div>
  );
}

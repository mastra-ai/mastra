import type { ToolStudioComponentProps } from '@mastra/core/tools';
import { Suspense, useContext } from 'react';
import type { ReactNode } from 'react';
import { ToolStudioComponentsContext } from './studio-components-context-value';
import { ErrorBoundary } from '@/ds/components/ErrorBoundary';

export interface ToolStudioComponentRendererProps extends ToolStudioComponentProps {
  /** Build-generated id of the component bundle. */
  id: string;
  /** Drawn while the bundle loads, and instead of the component when it fails to load or render. */
  fallback: ReactNode;
}

/** Draws a tool call with the custom component its tool registered through `ui.studioComponent`. */
export function ToolStudioComponent({ id, fallback, ...props }: ToolStudioComponentRendererProps) {
  const studioComponents = useContext(ToolStudioComponentsContext);
  if (!studioComponents) return fallback;

  const Component = studioComponents.getComponent(id);
  return (
    <ErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Component {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

import { lazy, useMemo } from 'react';
import type { LazyExoticComponent, ReactNode } from 'react';

import { ToolStudioComponentsContext } from './studio-components-context-value';
import type {
  LoadToolStudioComponent,
  ToolStudioComponent,
  ToolStudioComponentsContextValue,
} from './studio-components-context-value';

export type { LoadToolStudioComponent, ToolStudioComponent } from './studio-components-context-value';

export interface ToolStudioComponentsProviderProps {
  loadComponent: LoadToolStudioComponent;
  children: ReactNode;
}

/** Enables custom tool components (`createTool({ ui: { studioComponent } })`) in chat. The host decides where bundles live. */
export function ToolStudioComponentsProvider({ loadComponent, children }: ToolStudioComponentsProviderProps) {
  const value = useMemo<ToolStudioComponentsContextValue>(() => {
    const components = new Map<string, LazyExoticComponent<ToolStudioComponent>>();
    return {
      getComponent: id => {
        let component = components.get(id);
        if (!component) {
          component = lazy(() => loadComponent(id).then(loaded => ({ default: loaded })));
          components.set(id, component);
        }
        return component;
      },
    };
  }, [loadComponent]);

  return <ToolStudioComponentsContext.Provider value={value}>{children}</ToolStudioComponentsContext.Provider>;
}

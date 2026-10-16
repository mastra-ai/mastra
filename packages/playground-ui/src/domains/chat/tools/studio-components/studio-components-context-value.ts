import type { ToolStudioComponentProps } from '@mastra/core/tools';
import { createContext } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';

export type ToolStudioComponent = ComponentType<ToolStudioComponentProps>;

/** Loads the browser bundle of a custom tool component from its build-generated id. */
export type LoadToolStudioComponent = (id: string) => Promise<ToolStudioComponent>;

export interface ToolStudioComponentsContextValue {
  /** Returns a stable lazy component per id, so React keeps the loaded component across renders. */
  getComponent: (id: string) => LazyExoticComponent<ToolStudioComponent>;
}

export const ToolStudioComponentsContext = createContext<ToolStudioComponentsContextValue | undefined>(undefined);

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import type { ProjectNamespace } from './projectRoutes';

const ProjectRouteContext = createContext<ProjectNamespace | undefined>(undefined);

export function ProjectRouteProvider({ children, namespace }: { children: ReactNode; namespace: ProjectNamespace }) {
  return <ProjectRouteContext.Provider value={namespace}>{children}</ProjectRouteContext.Provider>;
}

export function useProjectNamespace(): ProjectNamespace | undefined {
  return useContext(ProjectRouteContext);
}

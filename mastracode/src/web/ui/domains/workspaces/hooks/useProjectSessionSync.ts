import { useEffect, useRef } from 'react';

import type { ConnectionStatus } from '../../chat/hooks/useAgentControllerConnection';
import type { Project } from '../services/projects';
import { deriveProjectPath } from './useWorkspaces';

export function useProjectSessionSync({
  setState,
  status,
  resourceId,
  activeProject,
}: {
  setState: (updates: Record<string, unknown>) => Promise<unknown>;
  status: ConnectionStatus;
  resourceId: string;
  activeProject: Project | null;
}) {
  const prevResourceId = useRef(resourceId);
  useEffect(() => {
    if (resourceId !== prevResourceId.current) {
      prevResourceId.current = resourceId;
      if (status === 'ready') {
        void setState({ projectPath: deriveProjectPath(activeProject) });
      }
    }
  }, [resourceId, status, activeProject, setState]);

  const initialSet = useRef(false);
  useEffect(() => {
    if (status === 'ready' && !initialSet.current && activeProject) {
      initialSet.current = true;
      void setState({ projectPath: deriveProjectPath(activeProject) });
    }
  }, [status, activeProject, setState]);
}

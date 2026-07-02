import { useEffect, useRef } from 'react';

import type { Project } from './projects';
import type { useAgentControllerSession } from './useAgentControllerSession';

type Session = ReturnType<typeof useAgentControllerSession>;

export function useProjectSessionSync({
  session,
  status,
  resourceId,
  activeProject,
}: {
  session: Session;
  status: Session['status'];
  resourceId: string;
  activeProject: Project | null;
}) {
  const prevResourceId = useRef(resourceId);
  useEffect(() => {
    if (resourceId !== prevResourceId.current) {
      prevResourceId.current = resourceId;
      if (status === 'ready') {
        void session.setState({ projectPath: activeProject?.path ?? '' });
      }
    }
  }, [resourceId, status, activeProject, session]);

  const initialSet = useRef(false);
  useEffect(() => {
    if (status === 'ready' && !initialSet.current && activeProject) {
      initialSet.current = true;
      void session.setState({ projectPath: activeProject.path });
    }
  }, [status, activeProject, session]);
}

import { useEffect } from 'react';

export function useProjectModalAutoOpen(projectCount: number, setProjectsOpen: (open: boolean) => void) {
  useEffect(() => {
    if (projectCount === 0) setProjectsOpen(true);
  }, [projectCount, setProjectsOpen]);
}

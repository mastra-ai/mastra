import { Wordmark } from '../../../../ui/icons';
import { useActiveProjectContext } from '../../../workspaces/context/ActiveProjectProvider';
import { ProjectMetadata } from './ProjectMetadata';

const emptyThreadClass = 'w-full max-w-[80ch] px-7 text-left font-mono text-sm leading-relaxed text-icon3';

export function EmptyThreadState() {
  const { activeProject } = useActiveProjectContext();
  if (!activeProject) return null;

  return (
    <div className={emptyThreadClass}>
      <Wordmark className="mb-6" />
      <dl className="mb-4 mt-0 grid gap-0.5">
        <ProjectMetadata label="Project" value={activeProject.name} />
        {activeProject.resourceId && <ProjectMetadata label="Resource ID" value={activeProject.resourceId} />}
        {activeProject.gitBranch && <ProjectMetadata label="Branch" value={activeProject.gitBranch} />}
        <ProjectMetadata label="Workspace" value={activeProject.path} />
      </dl>
      <p className="mb-6 mt-0 text-icon3">Ready for new conversation</p>
    </div>
  );
}

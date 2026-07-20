import { Wordmark } from '../../../../ui';
import { deriveProjectPath } from '../../../../../../shared/hooks/useWorkspaces';
import { useActiveFactoryContext } from '../../../workspaces';
import { FactoryMetadata } from './FactoryMetadata';

const emptyThreadClass = 'w-full max-w-[80ch] px-7 text-left font-mono text-sm leading-relaxed text-icon3';

export function EmptyThreadState() {
  const { activeFactory } = useActiveFactoryContext();
  if (!activeFactory) return null;
  const workspace = deriveProjectPath(activeFactory);

  return (
    <div className={emptyThreadClass}>
      <Wordmark className="mb-6" />
      <dl className="mb-4 mt-0 grid gap-0.5">
        <FactoryMetadata label="Factory" value={activeFactory.name} />
        {activeFactory.resourceId && <FactoryMetadata label="Resource ID" value={activeFactory.resourceId} />}
        {activeFactory.binding.gitBranch && <FactoryMetadata label="Branch" value={activeFactory.binding.gitBranch} />}
        {workspace && <FactoryMetadata label="Workspace" value={workspace} />}
      </dl>
      <p className="mb-6 mt-0 text-icon3">Ready for new conversation</p>
    </div>
  );
}

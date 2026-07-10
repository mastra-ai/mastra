import { useActiveProjectContext } from '../../workspaces';
import { Composer } from './Composer';
import { StatusLine } from './StatusLine';

const composerPanelClass = 'w-full shrink-0';

type ComposerPanelProps = {
  composerVariant?: 'inline' | 'textarea';
};

export function ComposerPanel({ composerVariant = 'inline' }: ComposerPanelProps) {
  const { activeProject } = useActiveProjectContext();

  if (!activeProject) return null;

  return (
    <div className={composerPanelClass}>
      <Composer variant={composerVariant} />
      <StatusLine />
    </div>
  );
}

import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useAddFactoryMutation } from '../../../../../shared/hooks/useFactories';
import { GithubIcon } from '../../../ui/icons';
import { useActiveFactoryContext } from '../context/ActiveFactoryProvider';
import { DirectoryBrowser } from './DirectoryPicker';

interface FactoriesPanelProps {
  onOpenGithub?: () => void;
  onClose?: () => void;
}

export function FactoriesPanel({ onOpenGithub, onClose }: FactoriesPanelProps) {
  const { selectFactory } = useActiveFactoryContext();
  const addLocalFactory = useAddFactoryMutation();
  const error =
    addLocalFactory.error instanceof Error
      ? addLocalFactory.error.message
      : addLocalFactory.error
        ? String(addLocalFactory.error)
        : null;

  const handlePick = async (path: string, name: string) => {
    try {
      const factory = await addLocalFactory.mutateAsync({ name: name || path, path });
      await selectFactory(factory);
      onClose?.();
    } catch {
      // Mutation state owns the rendered error.
    }
  };

  return (
    <section aria-labelledby="create-factory-title" className="flex min-h-0 flex-1 overflow-hidden p-4 md:p-6">
      <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
        <Txt id="create-factory-title" as="h1" variant="header-md">
          Create factory
        </Txt>
        {onOpenGithub && (
          <Button variant="outline" className="w-fit" onClick={onOpenGithub}>
            <GithubIcon />
            Create/connect factory from GitHub
          </Button>
        )}
        <Txt as="p" variant="ui-sm" className="text-icon3">
          Or choose a folder on this machine. A Factory binds to that directory so its threads, memory, and workspace
          stay scoped there — and are shared with the terminal.
        </Txt>
        <DirectoryBrowser
          onPick={(path, name) => void handlePick(path, name)}
          onCancel={onClose}
          busy={addLocalFactory.isPending}
          error={error}
        />
      </div>
    </section>
  );
}

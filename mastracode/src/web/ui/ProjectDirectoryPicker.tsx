import { Txt } from '@mastra/playground-ui';
import { useState } from 'react';

import { DirectoryBrowser } from './DirectoryPicker';
import type { Project } from './projects';
import { addProject, loadProjects } from './projects';

interface ProjectDirectoryPickerProps {
  onSelectProject: (project: Project) => void | Promise<void>;
  onProjectsChange: (projects: Project[]) => void;
  onClose?: () => void;
  onCancel?: () => void;
  variant?: 'dialog' | 'page';
}

export function ProjectDirectoryPicker({
  onSelectProject,
  onProjectsChange,
  onClose,
  onCancel,
  variant = 'dialog',
}: ProjectDirectoryPickerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = async (path: string, name: string) => {
    setBusy(true);
    setError(null);
    try {
      const project = await addProject(name || path, path);
      onProjectsChange(loadProjects());
      await onSelectProject(project);
      onClose?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const description =
    'Choose a local folder. Threads, memory, and workspace stay scoped to that directory and are shared with the terminal.';
  const browser = (
    <DirectoryBrowser
      onPick={(path, name) => void handlePick(path, name)}
      onCancel={onCancel}
      busy={busy}
      error={error}
      layout={variant === 'page' ? 'page' : 'dialog'}
    />
  );

  if (variant === 'page') {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <header className="border-b border-border1 px-4 py-5 md:px-8">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-1.5">
            <Txt as="h1" variant="header-md" className="text-icon6">
              Open a project
            </Txt>
            <Txt as="p" variant="ui-sm" className="max-w-[68ch] text-icon3">
              {description}
            </Txt>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 md:px-8">{browser}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Txt as="p" variant="ui-sm" className="text-icon3">
        {description}
      </Txt>
      {browser}
    </div>
  );
}

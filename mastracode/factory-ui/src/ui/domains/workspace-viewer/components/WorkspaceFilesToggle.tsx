import { Button } from '@mastra/playground-ui/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { PanelRightIcon } from 'lucide-react';

import { useWorkspaceFiles } from '../context/useWorkspaceFiles';
import { WorkspaceFilesContent } from './WorkspaceFilesContent';

export function WorkspaceFilesToggle() {
  const { open, setOpen, workspacePath, canDock } = useWorkspaceFiles();

  if (!workspacePath) return null;

  if (canDock) {
    return (
      <Button
        size="icon-sm"
        variant={open ? 'default' : 'ghost'}
        tooltip={open ? 'Hide workspace files' : 'Show workspace files'}
        aria-label="Workspace files"
        aria-pressed={open}
        onClick={() => setOpen(!open)}
      >
        <PanelRightIcon />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon-sm" variant={open ? 'default' : 'ghost'} aria-label="Workspace files" aria-pressed={open}>
          <PanelRightIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="h-[min(30rem,70vh)] w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden p-0"
      >
        <WorkspaceFilesContent />
      </PopoverContent>
    </Popover>
  );
}

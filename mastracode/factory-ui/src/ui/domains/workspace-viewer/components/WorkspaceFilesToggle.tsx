import { Button } from '@mastra/playground-ui/components/Button';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { PanelRightIcon } from 'lucide-react';

import { useWorkspacePanel } from '../context/useWorkspacePanel';
import { cardRadiusClass, popoverSizeClass } from '../layout';
import { WorkspaceFilesContent } from './WorkspaceFilesContent';

export function WorkspaceFilesToggle() {
  const { open, setOpen, workspacePath, size, setSize, canDock } = useWorkspacePanel();

  if (!workspacePath) return null;

  const setPopoverOpen = (next: boolean) => {
    if (next) setSize('compact');
    setOpen(next);
  };

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
    <Popover open={open} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button size="icon-sm" variant={open ? 'default' : 'ghost'} aria-label="Workspace files" aria-pressed={open}>
          <PanelRightIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className={cn(
          '[interpolate-size:allow-keywords] flex flex-col overflow-hidden p-0 transition-[width,height] duration-360 ease-out-custom motion-reduce:transition-none',
          cardRadiusClass,
          popoverSizeClass[size],
        )}
      >
        <WorkspaceFilesContent />
      </PopoverContent>
    </Popover>
  );
}

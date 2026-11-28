import { Button } from '@mastra/playground-ui/components/Button';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { SessionPanelToggle } from '@mastra/playground-ui/domains/factory';
import { useState } from 'react';

import { useWorkspacePanel } from '../context/useWorkspacePanel';
import {
  cardRadiusClass,
  cardWidthStyle,
  popoverSizeClass,
} from '@mastra/playground-ui/domains/factory/session/thread/workspace-viewer/layout';
import type { WorkspacePanelSize } from '@mastra/playground-ui/domains/factory/session/thread/workspace-viewer/layout';
import { WorkspaceFilesContent } from './WorkspaceFilesContent';
import { IconSidebarSimpleRightWide } from '@mastra/playground-ui/icons/central/IconSidebarSimpleRightWide';

export function WorkspaceFilesToggle() {
  const { open, setOpen, hasContent, canDock } = useWorkspacePanel();
  const [size, setSize] = useState<WorkspacePanelSize>('compact');

  if (!hasContent) return null;

  const setPopoverOpen = (next: boolean) => {
    if (next) setSize('compact');
    setOpen(next);
  };

  if (canDock) return <SessionPanelToggle open={open} onOpenChange={setOpen} />;

  return (
    <Popover open={open} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button size="icon-sm" variant={open ? 'default' : 'ghost'} aria-label="Session panel" aria-pressed={open}>
          <IconSidebarSimpleRightWide />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        style={cardWidthStyle}
        className={cn(
          '[interpolate-size:allow-keywords] flex flex-col overflow-hidden p-0 transition-[width,height] duration-360 ease-out-custom motion-reduce:transition-none',
          cardRadiusClass,
          popoverSizeClass[size],
        )}
      >
        <WorkspaceFilesContent visible={open} onSizeChange={setSize} />
      </PopoverContent>
    </Popover>
  );
}

import { Button } from '@mastra/playground-ui/components/Button';
import type { ButtonProps } from '@mastra/playground-ui/components/Button';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { AsideReveal, useMaybeSidebarState } from '@mastra/playground-ui/components/Sidebar';
import { useRef, useState } from 'react';
import type { Ref } from 'react';

import { useWorkspacePanel } from '../context/useWorkspacePanel';
import { cardRadiusClass, cardWidthStyle, popoverSizeClass } from '../layout';
import type { WorkspacePanelSize } from '../layout';
import { WorkspaceFilesContent } from './WorkspaceFilesContent';
import { IconSidebarSimpleRightWide } from '@mastra/playground-ui/icons/central/IconSidebarSimpleRightWide';

export function WorkspaceFilesToggle() {
  const { open, setOpen, workspacePath, canDock } = useWorkspacePanel();
  const isMobile = useMaybeSidebarState()?.isMobile ?? false;

  if (!workspacePath) return null;

  if (canDock) {
    return (
      <PanelButton
        open={open}
        tooltip={open ? 'Hide session panel' : 'Show session panel'}
        onClick={() => setOpen(!open)}
      />
    );
  }

  // Phones get the panel as a right-edge drawer, swiped in like the navigation drawer on the left.
  if (isMobile) return <PanelDrawer open={open} setOpen={setOpen} />;

  return <PanelPopover open={open} setOpen={setOpen} />;
}

type PanelProps = { open: boolean; setOpen: (open: boolean) => void };

function PanelButton({
  open,
  ref,
  ...props
}: { open: boolean; ref?: Ref<HTMLElement> } & Omit<ButtonProps, 'ref' | 'children'>) {
  return (
    <Button
      ref={ref}
      size="icon-sm"
      variant={open ? 'default' : 'ghost'}
      aria-label="Session panel"
      aria-pressed={open}
      {...props}
    >
      <IconSidebarSimpleRightWide />
    </Button>
  );
}

const keepSize = () => {};

function PanelDrawer({ open, setOpen }: PanelProps) {
  const triggerRef = useRef<HTMLElement>(null);
  return (
    <>
      <PanelButton ref={triggerRef} open={open} onClick={() => setOpen(!open)} />
      <AsideReveal open={open} onOpenChange={setOpen} label="Session panel" triggerRef={triggerRef} className="p-2">
        {/* The drawer is full height whatever the view, so it ignores size changes. */}
        <WorkspaceFilesContent visible={open} onSizeChange={keepSize} />
      </AsideReveal>
    </>
  );
}

function PanelPopover({ open, setOpen }: PanelProps) {
  const [size, setSize] = useState<WorkspacePanelSize>('compact');
  const onOpenChange = (next: boolean) => {
    if (next) setSize('compact');
    setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <PanelButton open={open} />
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

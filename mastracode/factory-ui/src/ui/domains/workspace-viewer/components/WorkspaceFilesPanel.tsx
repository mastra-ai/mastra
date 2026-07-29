import { Button } from '@mastra/playground-ui/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { cn } from '@mastra/playground-ui/utils/cn';
import { PanelRightIcon } from 'lucide-react';
import { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { renderedPaths } from '../config';
import { useThreadWorkspacePath } from '../hooks/useThreadWorkspacePath';
import { useWiderThan } from '../hooks/useWiderThan';
import { WorkspaceViewerPanel } from './WorkspaceViewerPanel';

// Docks only where chat column + card + gutters all fit, so revealing it never narrows the chat.
const CHAT_COLUMN_REM = 44;
const CARD_REM = 21;
const GUTTER_REM = 1.5;
const ROOT_FONT_SIZE = 16;
const DOCK_MIN_WIDTH = (CHAT_COLUMN_REM + CARD_REM + GUTTER_REM * 2) * ROOT_FONT_SIZE;

// Mirrors CHAT_COLUMN_REM — keep in sync.
const CHAT_COLUMN_CLASS = '[--chat-column:44rem]';

// Viewing grows into leftover room only (47rem = column + gutters) — never flips the dock decision.
const CARD_WIDTH_CLASS = {
  browsing: '[--workspace-files-card:21rem]',
  viewing: '[--workspace-files-card:min(34rem,calc(100%-47rem))]',
};

const RESERVED_SPACE_CLASS = {
  none: '[--workspace-files-inset:0px]',
  docked: '[--workspace-files-inset:calc(var(--workspace-files-card)+3rem)]',
};

/** Applied by every chat region that must stay clear of the docked card. */
export const workspaceFilesInsetClass =
  'pr-[var(--workspace-files-inset,0px)] transition-[padding] duration-360 ease-out-custom motion-reduce:transition-none';

interface WorkspaceFilesPanelValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  workspacePath?: string;
  viewingFile: boolean;
  setViewingFile: (viewing: boolean) => void;
  canDock: boolean;
}

const WorkspaceFilesPanelContext = createContext<WorkspaceFilesPanelValue | undefined>(undefined);

export function useWorkspaceFilesPanel() {
  const value = useContext(WorkspaceFilesPanelContext);
  if (!value) throw new Error('useWorkspaceFilesPanel must be used inside WorkspaceFilesPanelProvider');
  return value;
}

/** Owns the box the card measures itself against, and shares its state with the session header. */
export function WorkspaceFilesPanelProvider({ children }: { children: ReactNode }) {
  const { workspacePath } = useThreadWorkspacePath();
  const chatRef = useRef<HTMLDivElement>(null);
  const canDock = useWiderThan(chatRef, DOCK_MIN_WIDTH);
  const [toggled, setToggled] = useState<{ whileDocked: boolean; open: boolean }>();
  const [viewingFile, setViewingFile] = useState(false);

  // Toggle records the layout it was made in — crossing the threshold discards it, so a popover
  // left open closes itself and the docked card comes back.
  const open = toggled?.whileDocked === canDock ? toggled.open : canDock;
  const setOpen = (next: boolean) => setToggled({ whileDocked: canDock, open: next });

  const claimsSpace = open && canDock && Boolean(workspacePath);

  return (
    <WorkspaceFilesPanelContext.Provider value={{ open, setOpen, workspacePath, viewingFile, setViewingFile, canDock }}>
      <div
        ref={chatRef}
        className={cn(
          'flex h-full min-h-0 min-w-0 flex-col',
          CHAT_COLUMN_CLASS,
          CARD_WIDTH_CLASS[viewingFile ? 'viewing' : 'browsing'],
          claimsSpace ? RESERVED_SPACE_CLASS.docked : RESERVED_SPACE_CLASS.none,
        )}
      >
        {children}
      </div>
    </WorkspaceFilesPanelContext.Provider>
  );
}

function WorkspaceFilesContent() {
  const { workspacePath, setViewingFile } = useWorkspaceFilesPanel();
  if (!workspacePath) return null;

  return (
    <WorkspaceViewerPanel
      workspacePath={workspacePath}
      renderedPaths={renderedPaths}
      onExpandedChange={setViewingFile}
    />
  );
}

export function WorkspaceFilesToggle() {
  const { open, setOpen, workspacePath, canDock } = useWorkspaceFilesPanel();

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

/** The docked card. Stays mounted while hidden so the tree keeps its expanded folders. */
export function WorkspaceFilesSurface() {
  const { open, workspacePath, viewingFile, canDock } = useWorkspaceFilesPanel();

  if (!workspacePath || !canDock) return null;

  return (
    <div
      inert={!open}
      data-testid="workspace-files-card"
      className={cn(
        'border-border1 bg-surface3 absolute top-3 right-3 z-20 flex flex-col overflow-hidden rounded-2xl border',
        'shadow-[0_1px_2px_-1px_oklch(0%_0_0deg/12%),0_16px_40px_-20px_oklch(0%_0_0deg/22%)]',
        'duration-360 ease-out-custom transition-[translate,scale,opacity]',
        'will-change-[translate,opacity] motion-reduce:transition-none',
        'w-[var(--workspace-files-card)]',
        viewingFile ? 'h-[min(34rem,calc(100%-1.5rem))]' : 'max-h-[calc(100%-1.5rem)]',
        open
          ? 'translate-x-0 scale-100 opacity-100'
          : 'pointer-events-none translate-x-[calc(100%+0.75rem)] scale-[0.98] opacity-0',
      )}
    >
      <WorkspaceFilesContent />
    </div>
  );
}

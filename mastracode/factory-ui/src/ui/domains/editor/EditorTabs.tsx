import { cn } from '@mastra/playground-ui/utils/cn';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import type { EditorBuffer } from './buffers';

import './editor-activity.css';

interface EditorTabsProps {
  openPaths: string[];
  activePath: string | null;
  buffers: Record<string, EditorBuffer>;
  onSelect(path: string): void;
  onClose(path: string): void;
  /** True when the agent currently has a running tool call on this file. */
  isAgentActive?: (path: string) => boolean;
  /** Optional editor-scope actions rendered to the right of the tab strip. */
  trailing?: ReactNode;
}

function basename(path: string) {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? path : path.slice(slash + 1);
}

export function EditorTabs({
  openPaths,
  activePath,
  buffers,
  onSelect,
  onClose,
  isAgentActive,
  trailing,
}: EditorTabsProps) {
  if (openPaths.length === 0 && !trailing) return null;
  return (
    <div className="border-border bg-card flex h-9 w-full min-w-0 shrink-0 items-center border-b">
      <div className="flex min-w-0 flex-1 items-center overflow-x-auto overflow-y-hidden">
        {openPaths.map(path => {
          const buffer = buffers[path];
          const active = path === activePath;
          const agentBusy = isAgentActive?.(path);
          const label = basename(path);
          return (
            <div
              key={path}
              className={cn(
                'group border-border relative flex h-full max-w-48 min-w-0 shrink-0 items-center border-r transition-colors',
                active
                  ? 'bg-background text-foreground after:bg-accent3 after:absolute after:inset-x-0 after:top-0 after:h-px'
                  : 'text-muted-foreground hover:text-foreground hover:bg-fill-subtle',
                agentBusy && 'editor-activity-ring',
              )}
            >
              <button
                type="button"
                title={agentBusy ? `${path} — agent working` : path}
                onClick={() => onSelect(path)}
                className="text-label flex h-full min-w-0 flex-1 items-center gap-2 pr-1 pl-3 text-left"
              >
                <span className="truncate">{label}</span>
                {buffer?.dirty && (
                  <span className="bg-accent6 size-1.5 shrink-0 rounded-full" aria-label="Unsaved changes" />
                )}
              </button>
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  onClose(path);
                }}
                className="text-muted-foreground hover:bg-fill-hover hover:text-foreground mr-1 grid size-5 shrink-0 place-items-center rounded opacity-60 group-hover:opacity-100"
                aria-label={`Close ${label}`}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
      {trailing && (
        <div className="border-border flex shrink-0 items-center gap-0.5 border-l bg-inherit px-1">{trailing}</div>
      )}
    </div>
  );
}

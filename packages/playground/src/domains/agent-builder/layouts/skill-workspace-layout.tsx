import { Button } from '@mastra/playground-ui/components/Button';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowLeftIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

type ActiveTab = 'chat' | 'configure';

interface SkillWorkspaceLayoutProps {
  /** Title shown in the header (skill name). */
  title: ReactNode;
  /** Slot rendered first in the right action cluster (e.g. autosave indicator). */
  rightAside?: ReactNode;
  /** Slot for visibility select / other top-right actions. Shown on desktop only. */
  primaryAction?: ReactNode;
  /** Slot for mobile-only header actions (e.g. kebab menu). Shown below the lg breakpoint. */
  mobileExtra?: ReactNode;
  /** When false, hide the right-side form column entirely (chat takes the full width). */
  showForm?: boolean;
  chat: ReactNode;
  form: ReactNode;
  /** Optional destructive action rendered at the bottom of the configure panel. */
  deleteAction?: ReactNode;
}

export const SkillWorkspaceLayout = ({
  title,
  rightAside,
  primaryAction,
  mobileExtra,
  showForm = true,
  chat,
  form,
  deleteAction,
}: SkillWorkspaceLayoutProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex min-w-0 items-center gap-2 bg-surface1 px-3 py-2 md:px-6 md:py-3">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => navigate('/agent-builder/skills', { viewTransition: true })}
          className="rounded-full"
          tooltip="Skills list"
          data-testid="skill-edit-back-button"
        >
          <ArrowLeftIcon />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="min-w-0 truncate text-ui-md text-neutral6">{title}</div>
          {rightAside && <div className="shrink-0">{rightAside}</div>}
        </div>
        {primaryAction && <div className="shrink-0">{primaryAction}</div>}
        {mobileExtra && <div className="shrink-0 lg:hidden">{mobileExtra}</div>}
      </div>

      {/* Mobile tabs — only when there's a configure side to switch to.
       *  Mirrors the agent-builder pill-style segmented switch for visual parity. */}
      {showForm && (
        <div className="md:hidden px-4 pt-4 pb-2">
          <div
            role="tablist"
            aria-label="Workspace view"
            className="relative mx-auto flex h-9 w-full max-w-sm items-center rounded-full border border-border1 bg-surface3 p-0.5"
          >
            <span
              aria-hidden="true"
              className={cn(
                'absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-surface4',
                'transition-transform duration-200 ease-out',
                activeTab === 'configure' && 'translate-x-full',
              )}
            />
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'chat'}
              data-testid="skill-edit-tab-chat"
              onClick={() => setActiveTab('chat')}
              className={cn(
                'relative z-10 flex-1 rounded-full text-ui-md font-medium outline-none',
                'transition-colors duration-200',
                activeTab === 'chat' ? 'text-neutral5' : 'text-neutral3 hover:text-neutral4',
              )}
            >
              Chat
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'configure'}
              data-testid="skill-edit-tab-configure"
              onClick={() => setActiveTab('configure')}
              className={cn(
                'relative z-10 flex-1 rounded-full text-ui-md font-medium outline-none',
                'transition-colors duration-200',
                activeTab === 'configure' ? 'text-neutral5' : 'text-neutral3 hover:text-neutral4',
              )}
            >
              Configuration
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      <div
        className={cn(
          'grid min-h-0 flex-1 grid-cols-1',
          // On desktop, reserve space for the floating skill panel only when it
          // is visible — this lets the chat smoothly expand back to full width
          // if the panel were ever hidden again.
          showForm && 'md:grid-cols-[1fr_minmax(360px,40%)]',
        )}
      >
        <div
          className={cn(
            'min-w-0 min-h-0 overflow-hidden bg-surface1',
            showForm && activeTab !== 'chat' ? 'hidden' : 'block',
            'md:block',
            'md:transition-[grid-column] md:duration-300 md:ease-out',
          )}
        >
          <div className="flex h-full min-h-0 flex-col px-4 pt-4 pb-6 md:px-10">
            <div className="flex min-h-0 flex-1 flex-col md:max-w-[80ch] md:mx-auto w-full">{chat}</div>
          </div>
        </div>
        {showForm && (
          <div
            className={cn(
              'min-w-0 min-h-0 overflow-hidden bg-surface1',
              activeTab === 'configure' ? 'block' : 'hidden',
              'md:block',
              // Mobile uses the same page-layout padding as the rest of the
              // page so the configure panel sits flush at full width.
              // On desktop, render an elevated, rounded, bordered card that
              // slides in from the right. The slide is driven by a CSS
              // keyframe animation triggered the first time this element
              // mounts (which matches the moment showForm flips to true).
              'px-4 pb-6 md:p-4 md:bg-transparent',
            )}
            data-testid="skill-edit-configure-panel"
          >
            <div
              className={cn(
                'skill-panel-slide-in flex h-full min-h-0 flex-col overflow-hidden',
                'md:rounded-3xl md:border md:border-border1 md:bg-surface2',
              )}
            >
              <div className="min-h-0 flex-1 overflow-hidden">{form}</div>
              {deleteAction && (
                <div className="border-t border-border1 px-4 pb-4 pt-4 md:px-6" data-testid="skill-edit-delete-action">
                  {deleteAction}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

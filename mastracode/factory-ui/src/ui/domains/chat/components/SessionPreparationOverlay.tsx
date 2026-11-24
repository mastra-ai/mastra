import { ChatShell } from '@mastra/playground-ui/components/ChatShell';

import { TranscriptLoading } from './TranscriptLoading';

interface SessionPreparationOverlayProps {
  preparing: boolean;
}

export function SessionPreparationOverlay({ preparing }: SessionPreparationOverlayProps) {
  return (
    <div
      aria-hidden={!preparing}
      // `overflow-clip`, not `overflow-hidden`: a hidden overflow would hold the pinned box below instead of the scroller.
      className="session-preparation-overlay pointer-events-none absolute inset-0 z-5 overflow-clip bg-(--chat-surface) data-[preparing=false]:bg-transparent"
      data-preparing={preparing}
    >
      {/* Pinned to what the scroller shows: loaded history is usually taller than the screen and opens at its
          end, so a mask laid over the whole transcript would sweep its top, off screen. */}
      <div className="sticky top-0 h-[100cqh]">
        <div aria-hidden="true" className="session-preparation-veil absolute inset-x-0 opacity-0" />
        <div className="session-preparation-loader invisible absolute inset-0 z-1 -translate-y-1 bg-(--chat-surface) opacity-0">
          {/* Stays mounted through the exit fade; `aria-hidden` above drops it from the accessibility tree. */}
          <ChatShell.Column className="pt-[calc(var(--chat-header-room,0px)+1.5rem)]">
            <TranscriptLoading />
          </ChatShell.Column>
        </div>
      </div>
    </div>
  );
}

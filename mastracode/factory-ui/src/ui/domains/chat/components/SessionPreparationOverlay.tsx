import { TranscriptLoading } from './TranscriptLoading';

interface SessionPreparationOverlayProps {
  preparing: boolean;
}

export function SessionPreparationOverlay({ preparing }: SessionPreparationOverlayProps) {
  return (
    <div
      aria-hidden={!preparing}
      className="session-preparation-overlay pointer-events-none absolute inset-0 z-5 overflow-hidden bg-(--chat-surface) data-[preparing=false]:bg-transparent"
      data-preparing={preparing}
    >
      <div aria-hidden="true" className="session-preparation-veil absolute inset-x-0 opacity-0" />
      <div className="session-preparation-loader invisible absolute inset-0 z-1 flex -translate-y-1 bg-(--chat-surface) opacity-0">
        {/* Stays mounted through the exit fade; `aria-hidden` above drops it from the accessibility tree. */}
        <TranscriptLoading />
      </div>
    </div>
  );
}

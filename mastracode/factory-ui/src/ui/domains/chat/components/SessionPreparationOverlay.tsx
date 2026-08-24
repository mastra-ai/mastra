import { SessionPrepareSteps } from './SessionPrepareSteps';

interface SessionPreparationOverlayProps {
  historyInitializing: boolean;
  preparing: boolean;
}

export function SessionPreparationOverlay({ historyInitializing, preparing }: SessionPreparationOverlayProps) {
  return (
    <div
      aria-hidden={!preparing}
      className="session-preparation-overlay pointer-events-none sticky top-0 z-5 [margin-block-end:-100cqh] h-[100cqh] flex-none overflow-hidden bg-(--chat-surface) data-[preparing=false]:bg-transparent"
      data-preparing={preparing}
    >
      <div aria-hidden="true" className="session-preparation-veil absolute inset-x-0 opacity-0" />
      <div className="session-preparation-loader invisible absolute inset-0 z-1 flex -translate-y-1 bg-(--chat-surface) opacity-0">
        <SessionPrepareSteps finishing={!preparing} historyInitializing={historyInitializing} />
      </div>
    </div>
  );
}

import { SessionPrepareSteps } from './SessionPrepareSteps';

interface SessionPreparationOverlayProps {
  historyInitializing: boolean;
  preparing: boolean;
}

export function SessionPreparationOverlay({ historyInitializing, preparing }: SessionPreparationOverlayProps) {
  return (
    <div aria-hidden={!preparing} className="session-preparation-overlay" data-preparing={preparing}>
      <div aria-hidden="true" className="session-preparation-veil" />
      <div className="session-preparation-loader">
        <SessionPrepareSteps finishing={!preparing} historyInitializing={historyInitializing} />
      </div>
    </div>
  );
}

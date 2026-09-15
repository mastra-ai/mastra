import { Composer } from './Composer';

import './chat-enter.css';

const composerPanelClass = 'composer-enter min-w-0 w-full max-w-full shrink-0';

type ComposerPanelProps = {
  composerVariant?: 'inline' | 'textarea';
};

export function ComposerPanel({ composerVariant = 'inline' }: ComposerPanelProps) {
  return (
    <div className={composerPanelClass}>
      <Composer variant={composerVariant} />
    </div>
  );
}

import type { ReactNode } from 'react';

import { Composer } from './Composer';

import './chat-enter.css';

const composerPanelClass = 'composer-enter flex min-w-0 w-full max-w-full shrink-0 flex-col gap-1.5';

type ComposerPanelProps = {
  composerVariant?: 'inline' | 'textarea';
  statusLead?: ReactNode;
  autoFocus?: boolean;
};

export function ComposerPanel({ composerVariant = 'inline', statusLead, autoFocus }: ComposerPanelProps) {
  return (
    <div className={composerPanelClass}>
      <Composer variant={composerVariant} statusLead={statusLead} autoFocus={autoFocus} />
    </div>
  );
}

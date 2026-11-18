import { Logo } from '@mastra/playground-ui/components/Logo';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

import { emptyThreadClass } from '../domains/chat/components/EmptyThreadState';

export function CardDraftIntro({
  title,
  actions,
  titleId,
}: {
  title: ReactNode;
  actions: ReactNode;
  titleId?: string;
}) {
  return (
    <section className={emptyThreadClass} aria-labelledby={titleId}>
      <Logo size="md" aria-label="Mastra Code" />
      <div className="mt-7 max-w-2xl text-balance">{title}</div>
      <Txt variant="body-sm" tone="muted" className="mt-2 max-w-lg text-pretty">
        No session yet. Your first message starts one.
      </Txt>
      <div className="mt-7 flex w-full max-w-2xl flex-col items-center gap-3">{actions}</div>
    </section>
  );
}

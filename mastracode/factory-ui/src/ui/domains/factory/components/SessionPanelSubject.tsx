import { IconUser } from '@mastra/playground-ui/icons/central/IconUser';
import type { ReactNode } from 'react';

import { PanelSubject } from '../../workspace-viewer/components/PanelSubject';
import { useOpenSession } from '../hooks/useOpenSession';
import { useSessionCard } from '../hooks/useSessionCard';

export function SessionPanelSubject({ lead }: { lead: ReactNode | undefined }) {
  const card = useSessionCard();
  const session = useOpenSession();

  if (card.loading) return <PanelSubject lead={lead} loading />;
  if (card.item) return <PanelSubject lead={lead} title={card.item.title} />;
  return (
    <PanelSubject
      lead={lead}
      icon={session.isUserThread ? <IconUser aria-hidden className="text-muted-foreground size-icon-md" /> : undefined}
      title={session.title}
      loading={session.loading}
    />
  );
}

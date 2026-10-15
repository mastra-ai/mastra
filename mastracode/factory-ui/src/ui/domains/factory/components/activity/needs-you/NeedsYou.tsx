import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import { NEEDS_YOU_KINDS } from '../../../services/attention';
import { AttentionList } from './AttentionList';
import { FollowedDiscussions } from './FollowedDiscussions';
import { NeedsYouHeader } from './NeedsYouHeader';
import type { NeedsYouView } from './NeedsYouHeader';

export function NeedsYou({ factoryId }: { factoryId: string }) {
  const [view, setView] = useState<NeedsYouView>('open');

  return (
    <section aria-labelledby="needs-you-heading" className="flex flex-col gap-2">
      <NeedsYouHeader factoryId={factoryId} view={view} onViewChange={setView} />
      <AttentionList
        key={view}
        factoryId={factoryId}
        view={view}
        kinds={NEEDS_YOU_KINDS}
        emptySlot={
          <Txt as="p" variant="caption" tone="muted" className="m-0">
            {view === 'archived' ? 'Nothing archived.' : 'Nothing needs you right now.'}
          </Txt>
        }
      />
      <FollowedDiscussions key={`followed-${view}`} factoryId={factoryId} view={view} />
    </section>
  );
}

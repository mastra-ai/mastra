import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import { ATTENTION_KINDS, NEEDS_YOU_KINDS } from '../../../services/attention';
import { AttentionList } from './AttentionList';
import { FollowedDiscussions } from './FollowedDiscussions';
import { NeedsYouHeader } from './NeedsYouHeader';
import type { NeedsYouView } from './NeedsYouHeader';

function NothingHere({ children }: { children: string }) {
  return (
    <Txt as="p" variant="caption" tone="muted" className="m-0">
      {children}
    </Txt>
  );
}

/** Archived is history, so every kind shares one list; open keeps discussions apart from what waits on a person. */
function NeedsYouLists({ factoryId, view }: { factoryId: string; view: NeedsYouView }) {
  if (view === 'archived') {
    return (
      <AttentionList
        factoryId={factoryId}
        view="archived"
        kinds={ATTENTION_KINDS}
        emptySlot={<NothingHere>Nothing archived.</NothingHere>}
      />
    );
  }

  return (
    <>
      <AttentionList
        factoryId={factoryId}
        view="open"
        kinds={NEEDS_YOU_KINDS}
        emptySlot={<NothingHere>Nothing needs you right now.</NothingHere>}
      />
      <FollowedDiscussions factoryId={factoryId} />
    </>
  );
}

export function NeedsYou({ factoryId }: { factoryId: string }) {
  const [view, setView] = useState<NeedsYouView>('open');

  return (
    <section aria-labelledby="needs-you-heading" className="flex flex-col gap-2">
      <NeedsYouHeader factoryId={factoryId} view={view} onViewChange={setView} />
      <NeedsYouLists key={view} factoryId={factoryId} view={view} />
    </section>
  );
}

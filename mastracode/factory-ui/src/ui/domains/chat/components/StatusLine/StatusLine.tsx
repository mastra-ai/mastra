import { ComposerStatus, ComposerStatusEnd, ComposerStatusStart } from '@mastra/playground-ui/components/Composer';
import type { ReactNode } from 'react';

import { ConnectionActivity } from './ConnectionActivity';
import { GoalStatus } from './GoalStatus';
import { OperationalMemoryStatus } from './OperationalMemoryStatus';
import { QueuedFollowUps } from './QueuedFollowUps';
import { RuntimeActivity } from './RuntimeActivity';

/**
 * Session status footer below the composer: session context on the left, runtime readings on the
 * right. Pure composition root: each child reads its own slice of the existing chat/session context.
 */
export function StatusLine({ children }: { children?: ReactNode }) {
  return (
    <ComposerStatus aria-label="Session status line">
      <ComposerStatusStart>
        {children}
        <ConnectionActivity />
        <GoalStatus />
        <QueuedFollowUps />
      </ComposerStatusStart>
      <ComposerStatusEnd>
        <RuntimeActivity />
        <OperationalMemoryStatus />
      </ComposerStatusEnd>
    </ComposerStatus>
  );
}

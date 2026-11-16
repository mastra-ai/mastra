import { ComposerStatus } from '@mastra/playground-ui/components/Composer';
import type { ReactNode } from 'react';

import { ConnectionActivity } from './ConnectionActivity';
import { GoalStatus } from './GoalStatus';
import { OperationalMemoryStatus } from './OperationalMemoryStatus';
import { QueuedFollowUps } from './QueuedFollowUps';
import { RuntimeActivity } from './RuntimeActivity';

/**
 * Session status row above the composer, right-aligned and hidden when empty. Pure
 * composition root: each child reads its own slice of the existing chat/session context.
 * The model picker lives in the composer actions instead.
 */
export function StatusLine({ children }: { children?: ReactNode }) {
  return (
    <ComposerStatus aria-label="Session status line">
      {children}
      <OperationalMemoryStatus />
      <RuntimeActivity />
      <ConnectionActivity />
      <QueuedFollowUps />
      <GoalStatus />
    </ComposerStatus>
  );
}

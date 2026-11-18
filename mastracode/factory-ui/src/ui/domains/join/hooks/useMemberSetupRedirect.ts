import { useMemo } from 'react';

import { hasSeenMemberSetup } from '../services/memberSetup';
import { useMemberModelStep } from './useMemberSetup';

/**
 * Whether opening a Factory's home should go to its setup page first: once per Factory (the setup page records
 * the visit), while the member still has to connect their own model. Deep links (a session, a card, a new chat)
 * never redirect; they show the same step inline where it blocks. `pending` holds the board until the answer is
 * known, so it doesn't flash.
 */
export function useMemberSetupRedirect(factoryId: string | undefined): 'pending' | 'setup' | 'none' {
  const seen = useMemo(() => !factoryId || hasSeenMemberSetup(factoryId), [factoryId]);
  const step = useMemberModelStep(seen ? undefined : factoryId);
  if (seen || !factoryId) return 'none';
  if (!step.settled) return 'pending';
  return step.model === 'needed' ? 'setup' : 'none';
}

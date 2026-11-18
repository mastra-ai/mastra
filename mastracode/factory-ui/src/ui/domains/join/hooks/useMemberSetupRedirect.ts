import { useState } from 'react';

import { hasSeenMemberSetup, markMemberSetupSeen } from '../services/memberSetup';
import { useMemberModelStep } from './useMemberSetup';

/**
 * Whether opening a Factory's home should go to its setup page first: once per Factory, while the member
 * still has to connect their own model. Deep links (a session, a card, a new chat) never redirect; they show the
 * same step inline where it blocks. `pending` holds the board until the answer is known, so it doesn't flash.
 */
export function useMemberSetupRedirect(factoryId: string | undefined): 'pending' | 'setup' | 'none' {
  // Read once: marking the visit below must not turn this render's answer into "seen".
  const [seen] = useState(() => !factoryId || hasSeenMemberSetup(factoryId));
  const step = useMemberModelStep(seen ? undefined : factoryId);
  if (seen || !factoryId) return 'none';
  if (!step.settled) return 'pending';
  if (step.model !== 'needed') return 'none';
  markMemberSetupSeen(factoryId);
  return 'setup';
}

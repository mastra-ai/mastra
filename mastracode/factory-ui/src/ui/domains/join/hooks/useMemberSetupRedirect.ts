import { useLocalStorageStore } from '@mastra/playground-ui/hooks/use-local-storage-store';

import { memberSetupSeenStore } from '../services/memberSetup';
import { useMemberModelStep } from './useMemberModelStep';

/**
 * Whether opening a Factory's home should go to its setup page first: once per Factory (the setup page records
 * the visit), while the member still has to connect their own model. Deep links (a session, a card, a new chat)
 * never redirect; they show the same step inline where it blocks. `pending` holds the board until the answer is
 * known, so it doesn't flash.
 */
export function useMemberSetupRedirect(factoryId: string | undefined): 'pending' | 'setup' | 'none' {
  const seen = useLocalStorageStore(memberSetupSeenStore);
  const askFor = factoryId && !seen.has(factoryId) ? factoryId : undefined;
  const step = useMemberModelStep(askFor);
  if (!askFor) return 'none';
  if (!step.settled) return 'pending';
  return step.needsModel ? 'setup' : 'none';
}

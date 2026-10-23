import { useMastraClient } from '@mastra/react';
import { useLogout as useLogoutMutation } from '@mastra/react/hooks/auth';

import { clearDraftsOnLogout } from '@/domains/conversation/context/thread-draft-state';

/**
 * Signs the user out and clears their saved composer drafts once the session has ended,
 * so a failed sign-out keeps the drafts.
 */
export function useLogout() {
  const client = useMastraClient();

  return useLogoutMutation({
    onLoggedOut: ({ userId }) =>
      clearDraftsOnLogout(JSON.stringify([client.options.baseUrl, client.options.apiPrefix, userId])),
  });
}

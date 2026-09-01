import { useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../../../../../api/config';
import { mentionRosterQuery } from '../../../../../hooks/useFactoryMembers';
import type { CommentMentionRef } from '../../services/commentsWire';
import { resolveMentions } from './mentions';

/**
 * Structured mentions for a body about to be sent. The roster is awaited rather
 * than read from cache, so a send that beats the dropdown still carries its
 * mentions. `undefined` means the roster could not be read at all: the caller
 * decides whether that means "no mentions" or "leave the stored ones alone".
 */
export function useMentionResolver(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return async (body: string): Promise<CommentMentionRef[] | undefined> => {
    if (!body.includes('@')) return [];
    if (!factoryProjectId) return undefined;
    try {
      const roster = await queryClient.ensureQueryData(mentionRosterQuery(baseUrl, factoryProjectId));
      return resolveMentions(body, roster);
    } catch {
      return undefined;
    }
  };
}

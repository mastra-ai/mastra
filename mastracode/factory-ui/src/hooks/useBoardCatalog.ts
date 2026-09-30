import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { BoardCatalogResponse } from '../api/types';
import { useStoryboard } from '../ui/domains/storyboard/StoryboardProvider';
import { storyCatalog } from '../ui/domains/storyboard/storyBoards';

export function useBoardCatalog(factoryProjectId: string | undefined) {
  const { client } = useApiConfig();
  const storyLayout = useStoryboard()?.state.boardLayout ?? 'standard';
  return useQuery({
    queryKey: queryKeys.boardCatalog(factoryProjectId),
    enabled: !!factoryProjectId,
    queryFn: () => client.get<BoardCatalogResponse>(`/web/factory/projects/${factoryProjectId}/boards`),
    select: data => storyCatalog(data.boards, storyLayout),
  });
}

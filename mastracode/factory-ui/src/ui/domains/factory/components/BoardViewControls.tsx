import { BoardViewControls as SharedBoardViewControls } from '@mastra/playground-ui/domains/factory';
import type { ReactNode } from 'react';
import type { BoardFilterSources } from './boardFilterFields';

import type { BoardParticipant } from '../boardPeople';
import type { BoardView } from '../hooks/useBoardView';
import { boardFilterFields } from './boardFilterFields';
import { boardPropertiesMenuProps } from './BoardPropertiesMenu';

export function BoardViewControls({
  reviewsPullRequests,
  view,
  participants,
  availableLabels,
  currentUserId,
  filterSources,
  aside,
}: {
  reviewsPullRequests: boolean;
  view: BoardView;
  participants: readonly BoardParticipant[];
  availableLabels: readonly string[];
  currentUserId?: string;
  filterSources: BoardFilterSources;
  aside?: ReactNode;
}) {
  const { connectedSources, linearProjects } = filterSources;
  const fields = boardFilterFields({
    reviewsPullRequests,
    filters: view.filters,
    participants,
    availableLabels,
    connectedSources,
    linearProjects,
    currentUserId,
  });

  return <SharedBoardViewControls {...boardPropertiesMenuProps(view, fields, currentUserId)} aside={aside} />;
}

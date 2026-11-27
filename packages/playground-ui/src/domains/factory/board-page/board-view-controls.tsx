import type { ReactNode } from 'react';
import { BoardViewControls as SharedBoardViewControls } from '../board';
import type { BoardFilterSources } from './board-filter-fields';

import { boardFilterFields } from './board-filter-fields';
import type { BoardParticipant } from './board-people';
import { boardPropertiesMenuProps } from './board-properties-menu-props';
import type { BoardView } from './use-board-view';

export function FactoryBoardViewControls({
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

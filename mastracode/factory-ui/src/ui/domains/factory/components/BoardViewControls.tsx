import { BoardViewControls as SharedBoardViewControls } from '@mastra/playground-ui/domains/factory';
import type { ReactNode } from 'react';

import type { BoardParticipant } from '../boardPeople';
import { useBoardFilterSources } from '../hooks/useBoardFilterSources';
import type { BoardView } from '../hooks/useBoardView';
import { boardFilterFields } from './boardFilterFields';
import { boardPropertiesMenuProps } from './BoardPropertiesMenu';

export function BoardViewControls({
  reviewsPullRequests,
  view,
  participants,
  availableLabels,
  currentUserId,
  aside,
}: {
  reviewsPullRequests: boolean;
  view: BoardView;
  participants: readonly BoardParticipant[];
  availableLabels: readonly string[];
  currentUserId?: string;
  aside?: ReactNode;
}) {
  const { connectedSources, linearProjects } = useBoardFilterSources();
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

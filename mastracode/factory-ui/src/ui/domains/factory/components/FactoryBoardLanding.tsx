import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useSidebarHeaderSlots } from '../../chat/components/useSidebarHeaderSlots';
import { orderedBoards } from '../boardCatalog';
import { rememberedBoardPath } from '../services/boardViews';

export function FactoryBoardLanding({ factoryId }: { factoryId: string | undefined }) {
  const catalog = useBoardCatalog(factoryId);
  const first = catalog.isSuccess ? orderedBoards(catalog.data)[0] : undefined;
  if (first && factoryId) return <Navigate to={rememberedBoardPath(factoryId, first.id)} replace />;

  return (
    <BoardLandingLayout>
      <BoardLandingMessage isPending={catalog.isPending} isError={catalog.isError} />
    </BoardLandingLayout>
  );
}

// A page header, so a collapsed sidebar can still be reopened from here (useSidebarHeaderSlots).
function BoardLandingLayout({ children }: { children: ReactNode }) {
  const slots = useSidebarHeaderSlots();
  return <PageLayout {...slots}>{children}</PageLayout>;
}

function BoardLandingMessage({ isPending, isError }: { isPending: boolean; isError: boolean }) {
  if (isPending) return <p role="status">Loading boards…</p>;
  if (isError) return <p role="alert">Unable to load boards.</p>;
  return <p>No boards installed.</p>;
}

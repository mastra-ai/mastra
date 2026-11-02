import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useSidebarHeaderSlots } from '../../chat/components/useSidebarHeaderSlots';
import { orderedBoards } from '../boardCatalog';
import { rememberedBoardPath } from '../services/boardViews';
import { BoardLoadingSkeleton } from './BoardLoadingSkeleton';

export function FactoryBoardLanding({ factoryId }: { factoryId: string | undefined }) {
  const catalog = useBoardCatalog(factoryId);
  const first = catalog.isSuccess ? orderedBoards(catalog.data)[0] : undefined;
  if (first && factoryId) return <Navigate to={rememberedBoardPath(factoryId, first.id)} replace />;

  return (
    <BoardLandingLayout loading={catalog.isPending}>
      <BoardLandingMessage isPending={catalog.isPending} isError={catalog.isError} />
    </BoardLandingLayout>
  );
}

// A page header, so a collapsed sidebar can still be reopened from here (useSidebarHeaderSlots).
function BoardLandingLayout({ children, loading }: { children: ReactNode; loading: boolean }) {
  const slots = useSidebarHeaderSlots();
  return (
    <PageLayout variant={loading ? 'fit' : undefined} {...slots}>
      {children}
    </PageLayout>
  );
}

function BoardLandingMessage({ isPending, isError }: { isPending: boolean; isError: boolean }) {
  if (isPending) return <BoardLoadingSkeleton />;
  if (isError) return <p role="alert">Unable to load boards.</p>;
  return <p>No boards installed.</p>;
}

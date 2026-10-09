import { Navigate } from 'react-router';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { orderedBoards } from '../boardCatalog';
import { rememberedBoardPath } from '../services/boardViews';

export function FactoryBoardLanding({ factoryId }: { factoryId: string | undefined }) {
  const catalog = useBoardCatalog(factoryId);
  if (catalog.isPending) return <p role="status">Loading boards…</p>;
  if (catalog.isError) return <p role="alert">Unable to load boards.</p>;
  const first = orderedBoards(catalog.data)[0];
  if (!first || !factoryId) return <p>No boards installed.</p>;
  return <Navigate to={rememberedBoardPath(factoryId, first.id)} replace />;
}

import { Navigate } from 'react-router';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { boardPath, orderedBoards } from '../boardCatalog';

export function FactoryBoardLanding({ factoryId }: { factoryId: string | undefined }) {
  const catalog = useBoardCatalog(factoryId);
  if (catalog.isPending) return <p role="status">Loading boards…</p>;
  if (catalog.isError) return <p role="alert">Unable to load boards.</p>;
  const first = orderedBoards(catalog.data)[0];
  if (!first || !factoryId) return <p>No boards installed.</p>;
  return <Navigate to={boardPath(factoryId, first.id)} replace />;
}

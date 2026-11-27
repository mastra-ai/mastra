import { BoardLoadingSkeleton as SharedBoardLoadingSkeleton } from '@mastra/playground-ui/domains/factory';
import { useSearchParams } from 'react-router';

import { boardLayoutFromParams } from '../boardLayout';

/** The catalog loads before phase names exist; keep the board's frame and selected layout. */
export function BoardLoadingSkeleton() {
  const [params] = useSearchParams();
  return <SharedBoardLoadingSkeleton layout={boardLayoutFromParams(params)} />;
}

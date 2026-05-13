import { Truncate } from '@mastra/playground-ui';
import { useParams } from 'react-router';

export function TraceCrumb() {
  const { traceId } = useParams<{ traceId: string }>();
  if (!traceId) return null;

  return (
    <Truncate untilChar="-" copy>
      {traceId}
    </Truncate>
  );
}

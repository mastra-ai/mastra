import { Notice } from '@mastra/playground-ui/components/Notice';
import type { DataPart } from '@mastra/react/ui';

import { routingNoticeText } from '../services/routing-notice';

/** A persisted account-switch or model-fallback part, as a transcript notice. */
export function RoutingNotice({ part }: { part: DataPart }) {
  const text = routingNoticeText(part);
  if (!text) return null;
  return (
    <Notice className="my-2" variant="info">
      {text}
    </Notice>
  );
}

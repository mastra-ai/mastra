import type { ScheduleStatus } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui';

export const ScheduleStatusBadge = ({ status }: { status: ScheduleStatus }) => {
  const variant = status === 'active' ? 'success' : 'default';
  return <Badge variant={variant}>{status}</Badge>;
};

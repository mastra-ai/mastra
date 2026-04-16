import { EmptyState } from '@mastra/playground-ui';
import { CircleSlashIcon } from 'lucide-react';

export const NoLogsInfo = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<CircleSlashIcon />}
      titleSlot="No logs yet"
      descriptionSlot="Logs will appear here once agents, workflows, or tools are executed."
    />
  </div>
);

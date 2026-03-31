import { CircleSlashIcon } from 'lucide-react';
import { EmptyState } from '@/ds/components/EmptyState';

export const NoLogsInfo = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<CircleSlashIcon />}
      titleSlot="No logs yet"
      descriptionSlot="Logs will appear here once agents, workflows, or tools are executed."
    />
  </div>
);

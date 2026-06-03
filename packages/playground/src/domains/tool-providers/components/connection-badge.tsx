import { Button } from '@mastra/playground-ui';
import { Settings } from 'lucide-react';

export interface ConnectionBadgeProps {
  providerId: string;
  toolkit: string;
  connectionId: string;
  label?: string | null;
  disabled?: boolean;
  onManage: () => void;
}

export const ConnectionBadge = ({
  providerId,
  toolkit,
  connectionId,
  label,
  disabled = false,
  onManage,
}: ConnectionBadgeProps) => {
  const testId = `connection-badge-${providerId}-${toolkit}-${connectionId}`;
  const displayLabel = label?.trim() || 'Unnamed connection';

  return (
    <div data-testid={testId} className="inline-flex max-w-[16rem] items-center gap-1">
      <span className="min-w-0 truncate text-ui-sm text-neutral6">{displayLabel}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        tooltip="Manage"
        aria-label={`Manage ${displayLabel}`}
        onClick={onManage}
        disabled={disabled}
        data-testid={`connection-badge-manage-${providerId}-${toolkit}-${connectionId}`}
      >
        <Settings />
      </Button>
    </div>
  );
};

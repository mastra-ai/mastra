import type { ReactNode } from 'react';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

export function OnboardingReviewRow({
  icon,
  label,
  value,
  detail,
  disabled,
  onEdit,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  disabled: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="flex min-h-10 items-start gap-3">
      <span className="text-muted-foreground mt-1 size-4 shrink-0 [&>svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <Txt variant="caption" className="truncate">
          {value}
        </Txt>
        {detail && (
          <Txt variant="meta" tone="muted" className="mt-1">
            {detail}
          </Txt>
        )}
      </div>
      <Button variant="ghost" size="sm" aria-label={`Edit ${label.toLowerCase()}`} disabled={disabled} onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
}

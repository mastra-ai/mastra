import { Button } from '@mastra/playground-ui/components/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';

export function UnavailableToolButton({
  icon,
  label,
  reason,
}: {
  icon: React.ReactNode;
  label: string;
  reason: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span tabIndex={0} className="inline-flex">
            <Button variant="ghost" size="icon-md" disabled aria-label={label}>
              {icon}
            </Button>
          </span>
        }
      />
      <TooltipContent side="bottom">
        <div>{label}</div>
        <div>{reason}</div>
      </TooltipContent>
    </Tooltip>
  );
}

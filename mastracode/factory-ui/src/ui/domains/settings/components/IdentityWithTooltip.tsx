import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';

export function IdentityWithTooltip({ label, idLabel, id }: { label: string; idLabel: string; id: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0}>{label}</span>} />
      <TooltipContent>
        {idLabel}: {id}
      </TooltipContent>
    </Tooltip>
  );
}

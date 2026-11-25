import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';

export interface LogStreamOrigin {
  icon: ReactNode;
  label: string;
}

export function LogStreamOriginIcon({ icon, label }: LogStreamOrigin) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span role="img" aria-label={label} className="mr-2 inline-flex align-middle text-muted-foreground" />}
      >
        <Icon size="sm">{icon}</Icon>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

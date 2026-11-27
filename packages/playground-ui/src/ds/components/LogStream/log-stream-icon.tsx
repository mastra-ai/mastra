import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';

export interface LogStreamIcon {
  element: ReactNode;
  label: string;
}

export function LogStreamLineIcon({ element, label }: LogStreamIcon) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span role="img" aria-label={label} className="mr-2 inline-flex align-middle text-muted-foreground" />}
      >
        <Icon size="sm">{element}</Icon>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

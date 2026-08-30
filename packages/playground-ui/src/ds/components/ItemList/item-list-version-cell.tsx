import { format } from 'date-fns';
import { BanIcon, ClockIcon } from 'lucide-react';
import { Badge } from '../Badge/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip';
import { ItemListCell } from './item-list-cell';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type ItemListVersionCellProps = {
  version: string | number;
  date?: Date | string | null;
  isLatest?: boolean;
  isDeleted?: boolean;
};

export function ItemListVersionCell({ version, date, isLatest, isDeleted }: ItemListVersionCellProps) {
  return (
    <ItemListCell className={cn('grid grid-cols-[1fr_auto] pl-1')}>
      <div
        className={cn('grid gap-1 leading-none text-neutral3', {
          'text-neutral4': isLatest,
        })}
      >
        <strong className="font-normal">v. {version}</strong>
        <em className={cn('text-ui-sm', 'font-normal', 'text-neutral2')}>
          {date ? format(new Date(date), 'MMM d, yyyy HH:mm') : null}
        </em>
      </div>
      {(isLatest || isDeleted) && (
        <div className="flex items-center gap-1">
          {isLatest && (
            <Tooltip>
              <TooltipTrigger
                render={<span />}
                role="img"
                tabIndex={0}
                aria-label="Latest version"
                className={cn('inline-flex rounded', focusRing.visible)}
              >
                <Badge variant="info" size="sm" icon={<ClockIcon />} />
              </TooltipTrigger>
              <TooltipContent>Latest version</TooltipContent>
            </Tooltip>
          )}
          {isDeleted && (
            <Tooltip>
              <TooltipTrigger
                render={<span />}
                role="img"
                tabIndex={0}
                aria-label="Deleted in this version"
                className={cn('inline-flex rounded', focusRing.visible)}
              >
                <Badge variant="error" size="sm" icon={<BanIcon />} />
              </TooltipTrigger>
              <TooltipContent>Deleted in this version</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </ItemListCell>
  );
}

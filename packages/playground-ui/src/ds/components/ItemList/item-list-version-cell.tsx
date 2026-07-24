import { format } from 'date-fns';
import { BanIcon, ClockIcon } from 'lucide-react';
import { Chip } from '../Chip';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip';
import { ItemListCell } from './item-list-cell';
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
        <em className="text-ui-sm text-neutral2 font-normal">
          {date ? format(new Date(date), 'MMM d, yyyy HH:mm') : null}
        </em>
      </div>
      {(isLatest || isDeleted) && (
        <div className="flex items-center gap-1">
          {isLatest && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Chip color="blue">
                  <ClockIcon />
                </Chip>
              </TooltipTrigger>
              <TooltipContent>Latest version</TooltipContent>
            </Tooltip>
          )}
          {isDeleted && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Chip color="red">
                  <BanIcon />
                </Chip>
              </TooltipTrigger>
              <TooltipContent>Deleted in this version</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </ItemListCell>
  );
}

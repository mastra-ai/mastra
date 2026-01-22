import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip';
import { EntryListStatus } from './types';

export type EntryListEntryTextColProps = {
  children: React.ReactNode;
  isLoading?: boolean;
};

export function EntryListEntryTextCol({ children, isLoading }: EntryListEntryTextColProps) {
  return (
    <div className="text-neutral4 text-ui-md truncate ">
      {isLoading ? (
        <div className="bg-surface4 rounded-md animate-pulse text-transparent h-[1rem] select-none"></div>
      ) : (
        children
      )}
    </div>
  );
}

export type EntryListEntryStatusColProps = {
  status?: EntryListStatus;
};

export function EntryListEntryStatusCol({ status }: EntryListEntryStatusColProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('flex justify-center items-center w-full h-4 relative cursor-help')}>
          {status ? (
            <div
              className={cn('w-[0.4rem] h-[0.4rem] rounded-full', {
                'bg-green-700': status === 'success',
                'bg-red-700': status === 'error',
                'bg-yellow-600': status === 'running',
                'bg-blue-700': status === 'suspended',
              })}
            ></div>
          ) : (
            <div className="text-neutral2 text-ui-sm leading-none">-</div>
          )}
          <VisuallyHidden>Status: {status ? status : 'not provided'}</VisuallyHidden>
        </div>
      </TooltipTrigger>
      <TooltipContent className="capitalize">{status || 'not provided'}</TooltipContent>
    </Tooltip>
  );
}

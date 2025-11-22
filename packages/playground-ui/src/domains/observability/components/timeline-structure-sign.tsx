import { cn } from '@/lib/utils';
import { CircleChevronDownIcon, CircleChevronUpIcon } from 'lucide-react';

type TimelineStructureSignProps = {
  isLastChild?: boolean;
  hasChildren?: boolean;
  expanded?: boolean;
};

export function TimelineStructureSign({
  isLastChild,
  hasChildren = false,
  expanded = false,
}: TimelineStructureSignProps) {
  return (
    <div
      className={cn(
        'w-[3rem] h-[2.8rem] relative opacity-100',
        'after:content-[""] after:absolute after:left-[-1px] after:top-0 after:bottom-0 after:w-[0px] after:border-l-[1px] after:border-icon3 after:border-dashed ',
        'before:content-[""] before:absolute before:left-0 before:top-[50%] before:w-full before:h-[0px] before:border-b-[1px] before:border-icon3 before:border-dashed',
        '[&_svg]:transition-all',
        '[&:hover_svg]:text-yellow-500 [&:hover_svg]:scale-[1.3] [&:hover_svg]:opacity-100',
        {
          'after:bottom-[50%]': isLastChild,
        },
      )}
    >
      {hasChildren && (
        <span
          className={cn(
            'flex absolute left-[50%] top-[50%] translate-y-[-50%] translate-x-[-50%] items-center justify-center bg-surface2 p-[0.25rem]',
            '[&>svg]:shrink-0 [&>svg]:opacity-60 [&>svg]:w-[0.8rem] [&>svg]:h-[0.8rem]',
          )}
        >
          {expanded ? <CircleChevronUpIcon /> : <CircleChevronDownIcon />}
        </span>
      )}
    </div>
  );
}

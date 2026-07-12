import { cn } from '@mastra/playground-ui/utils/cn';
import { CircleChevronDownIcon, CircleChevronUpIcon } from 'lucide-react';

type ExperimentTraceTimelineStructureSignProps = {
  isLastChild?: boolean;
  hasChildren?: boolean;
  expanded?: boolean;
};

export function ExperimentTraceTimelineStructureSign({
  isLastChild,
  hasChildren = false,
  expanded = false,
}: ExperimentTraceTimelineStructureSignProps) {
  return (
    <div
      className={cn(
        'relative h-[2.8rem] w-12 opacity-100',
        'after:absolute after:inset-y-0 after:-left-px after:w-0 after:border-l after:border-dashed after:border-neutral3 after:content-[""] ',
        'before:absolute before:top-[50%] before:left-0 before:h-0 before:w-full before:border-b before:border-dashed before:border-neutral3 before:content-[""]',
        '[&_svg]:transition-all',
        '[&:hover_svg]:scale-1.3 [&:hover_svg]:text-yellow-500 [&:hover_svg]:opacity-100',
        {
          'after:bottom-[50%]': isLastChild,
        },
      )}
    >
      {hasChildren && (
        <span
          className={cn(
            'absolute top-[50%] left-[50%] flex translate-[-50%] items-center justify-center bg-surface2 p-1',
            '[&>svg]:size-[0.8rem] [&>svg]:shrink-0 [&>svg]:opacity-60',
          )}
        >
          {expanded ? <CircleChevronUpIcon /> : <CircleChevronDownIcon />}
        </span>
      )}
    </div>
  );
}

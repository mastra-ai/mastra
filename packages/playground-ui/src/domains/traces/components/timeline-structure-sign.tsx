import { cn } from '@/lib/utils';

type TimelineStructureSignProps = {
  isLastChild?: boolean;
};

export function TimelineStructureSign({ isLastChild }: TimelineStructureSignProps) {
  return (
    <div
      className={cn(
        'relative h-[1.8rem] w-2 shrink-0 opacity-100',
        'after:absolute after:inset-y-0 after:-left-px after:w-0 after:border-l-[1px] after:border-dashed after:border-neutral3 after:content-[""] ',
        'before:absolute before:top-[50%] before:left-0 before:h-0 before:w-full before:border-b-[1px] before:border-dashed before:border-neutral3 before:content-[""]',
        {
          'after:bottom-[50%]': isLastChild,
        },
      )}
    />
  );
}

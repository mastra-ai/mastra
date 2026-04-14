import { cn } from '@mastra/playground-ui';

type TimelineStructureSignProps = {
  isLastChild?: boolean;
};

export function TimelineStructureSign({ isLastChild }: TimelineStructureSignProps) {
  return (
    <div
      className={cn(
        'w-[0.5rem] h-[1.8rem] relative opacity-100 shrink-0',
        'after:content-[""] after:absolute after:left-[-1px] after:top-0 after:bottom-0 after:w-[0px] after:border-l-[1px] after:border-neutral3 after:border-dashed ',
        'before:content-[""] before:absolute before:left-0 before:top-[50%] before:w-full before:h-[0px] before:border-b-[1px] before:border-neutral3 before:border-dashed',
        {
          'after:bottom-[50%]': isLastChild,
        },
      )}
    />
  );
}

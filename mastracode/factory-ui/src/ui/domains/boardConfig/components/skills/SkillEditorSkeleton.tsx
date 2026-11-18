import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { textStyle } from '@mastra/playground-ui/primitives/text';
import { cn } from '@mastra/playground-ui/utils/cn';

const INSTRUCTION_LINES = ['w-full', 'w-11/12', 'w-full', 'w-4/5', 'w-2/3'];

export function SkillEditorSkeleton({ name }: { name: string }) {
  return (
    <div role="status" aria-label="Loading skill" className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Txt as="h1" variant="display-lg" tone="ink" className="min-w-0 break-words">
          {name}
        </Txt>
        <div aria-hidden className={textStyle({ variant: 'body' })}>
          <span className="inline-flex w-full flex-col align-[5px]">
            <SkeletonText line="text-body" className="w-full motion-reduce:before:animate-none" />
          </span>
        </div>
      </div>
      <div aria-hidden>
        {INSTRUCTION_LINES.map((width, index) => (
          <SkeletonText key={index} line="text-body" className={cn('motion-reduce:before:animate-none', width)} />
        ))}
      </div>
    </div>
  );
}

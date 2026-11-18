import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { textStyle } from '@mastra/playground-ui/primitives/text';
import { cn } from '@mastra/playground-ui/utils/cn';

import { SkillToolbar } from './SkillEditor';

const INSTRUCTION_LINES = ['w-full', 'w-11/12', 'w-full', 'w-4/5', 'w-2/3'];

export function SkillEditorSkeleton({ toolbar }: { toolbar: boolean }) {
  return (
    <div role="status" aria-label="Loading skill">
      <div aria-hidden className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          {toolbar && (
            <SkillToolbar>
              <Skeleton className="h-5 w-16 rounded-[7px] motion-reduce:before:animate-none" />
            </SkillToolbar>
          )}
          <SkeletonText line="text-display-lg" className="h-6 w-2/3 motion-reduce:before:animate-none" />
          <div className={textStyle({ variant: 'body' })}>
            <span className="inline-flex w-full flex-col align-[5px]">
              <SkeletonText line="text-body" className="w-full motion-reduce:before:animate-none" />
            </span>
          </div>
        </div>
        <div>
          {INSTRUCTION_LINES.map((width, index) => (
            <SkeletonText key={index} line="text-body" className={cn('motion-reduce:before:animate-none', width)} />
          ))}
        </div>
      </div>
    </div>
  );
}

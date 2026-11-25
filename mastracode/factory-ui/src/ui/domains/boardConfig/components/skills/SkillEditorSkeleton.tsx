import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';

const bar = 'motion-reduce:before:animate-none';
const DESCRIPTION_LINES = ['w-full', 'w-2/3'];
const INSTRUCTION_LINES = ['w-full', 'w-11/12', 'w-full', 'w-3/4'];

export function SkillEditorSkeleton() {
  return (
    <div role="status" aria-label="Loading skill" className="flex flex-col gap-8">
      <div className="flex flex-col">
        {DESCRIPTION_LINES.map(width => (
          <SkeletonText key={width} line="text-body" className={cn(width, bar)} />
        ))}
      </div>
      <div className="flex flex-col">
        {INSTRUCTION_LINES.map((width, index) => (
          <SkeletonText key={index} line="text-body leading-6" className={cn(width, bar)} />
        ))}
      </div>
    </div>
  );
}

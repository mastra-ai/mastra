import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { LANE_SECTIONS } from '../ruleLanes';
import { LaneCard, LaneFooter, LaneSection } from './RuleLaneFrame';

export function BoardRulesSkeleton() {
  return (
    <div role="status" aria-label="Loading rules" className="flex flex-col gap-8">
      {LANE_SECTIONS.map(section => (
        <LaneSection
          key={section.title}
          title={section.title}
          events={section.events}
          chain={<SkeletonText line="text-caption" className="w-64 max-w-full motion-reduce:before:animate-none" />}
        >
          {section.events.map(event => (
            <LaneCard key={event} event={event}>
              <LaneFooter>
                <Skeleton aria-hidden className="size-4 shrink-0 rounded-full motion-reduce:before:animate-none" />
                <SkeletonText line="text-caption" className="w-48 motion-reduce:before:animate-none" />
              </LaneFooter>
            </LaneCard>
          ))}
        </LaneSection>
      ))}
    </div>
  );
}

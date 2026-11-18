import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { LANE_SECTIONS } from '../ruleLanes';
import { LANE_CARD, LANE_FOOTER, LaneHeading, LaneSection } from './RuleLaneFrame';

export function BoardRulesSkeleton() {
  return (
    <div role="status" aria-label="Loading rules">
      <div aria-hidden className="flex flex-col gap-8">
        {LANE_SECTIONS.map(section => (
          <LaneSection
            key={section.title}
            title={section.title}
            events={section.events}
            chain={<SkeletonText line="text-caption" className="w-64 max-w-full motion-reduce:before:animate-none" />}
          >
            {section.events.map(event => (
              <div key={event} className={LANE_CARD}>
                <LaneHeading event={event} />
                <div className={LANE_FOOTER}>
                  <Skeleton className="size-4 shrink-0 rounded-full motion-reduce:before:animate-none" />
                  <SkeletonText line="text-caption" className="w-48 motion-reduce:before:animate-none" />
                </div>
              </div>
            ))}
          </LaneSection>
        ))}
      </div>
    </div>
  );
}

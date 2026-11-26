import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { LANE_SECTIONS } from '../ruleLanes';
import type { RuleEvent } from '../ruleLanes';
import { RULE_LANE, RuleLaneFallback, RuleLaneHeader } from './RuleLane';
import { RULE_SECTIONS, RuleSection } from './RuleSection';

function RuleLaneSkeleton({ event }: { event: RuleEvent }) {
  return (
    <div className={RULE_LANE}>
      <RuleLaneHeader event={event} />
      <RuleLaneFallback>
        <SkeletonText line="text-caption" className="w-56 motion-reduce:before:animate-none" />
      </RuleLaneFallback>
    </div>
  );
}

export function BoardRulesSkeleton() {
  return (
    <div role="status" aria-label="Loading rules">
      <div aria-hidden className={RULE_SECTIONS}>
        {LANE_SECTIONS.map(section => (
          <RuleSection
            key={section.title}
            section={section}
            intakeChain={
              <SkeletonText
                line="text-caption leading-6 ps-2"
                className="w-96 max-w-full motion-reduce:before:animate-none"
              />
            }
          >
            {section.events.map(event => (
              <RuleLaneSkeleton key={event} event={event} />
            ))}
          </RuleSection>
        ))}
      </div>
    </div>
  );
}

import { Button } from '@mastra/playground-ui/components/Button';
import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { FACTORY_SWITCHER_TRIGGER, FactorySwitcherTriggerContent } from './FactorySwitcher';

export function FactorySwitcherSkeleton() {
  return (
    <div inert className="contents">
      <Button type="button" variant="ghost" size="sm" aria-label="Select factory" className={FACTORY_SWITCHER_TRIGGER}>
        <FactorySwitcherTriggerContent>
          <SkeletonText line="text-caption" className="w-20 motion-reduce:before:animate-none" />
        </FactorySwitcherTriggerContent>
      </Button>
    </div>
  );
}

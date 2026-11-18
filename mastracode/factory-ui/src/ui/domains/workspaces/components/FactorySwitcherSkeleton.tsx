import { Button } from '@mastra/playground-ui/components/Button';

import { FACTORY_SWITCHER_TRIGGER, FactoryNameSkeleton, FactorySwitcherTriggerContent } from './FactorySwitcher';

export function FactorySwitcherSkeleton() {
  return (
    <div inert className="contents">
      <Button type="button" variant="ghost" size="sm" aria-label="Select factory" className={FACTORY_SWITCHER_TRIGGER}>
        <FactorySwitcherTriggerContent>
          <FactoryNameSkeleton />
        </FactorySwitcherTriggerContent>
      </Button>
    </div>
  );
}

import { Button } from '@mastra/playground-ui/components/Button';

import { FACTORY_SWITCHER_TRIGGER, FactoryNameSkeleton, FactorySwitcherTriggerContent } from './FactorySwitcher';

export function FactorySwitcherSkeleton() {
  return (
    <Button variant="ghost" size="sm" disabled aria-hidden tabIndex={-1} className={FACTORY_SWITCHER_TRIGGER}>
      <FactorySwitcherTriggerContent>
        <FactoryNameSkeleton />
      </FactorySwitcherTriggerContent>
    </Button>
  );
}

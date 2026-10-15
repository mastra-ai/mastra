import { CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import type { Ref } from 'react';

/** `mr-auto` pushes the footer's actions to the right while the toggle sits there; in the body it does nothing. */
export function AdvancedToggle({ toggleRef }: { toggleRef: Ref<HTMLButtonElement> }) {
  return (
    <CollapsibleTrigger ref={toggleRef} variant="form" className="mr-auto">
      Advanced
    </CollapsibleTrigger>
  );
}

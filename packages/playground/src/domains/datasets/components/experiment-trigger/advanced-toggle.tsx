import { CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import type { Ref } from 'react';

/**
 * Chevron, then a muted label, flush with the field labels. `mr-auto` pushes the footer's actions to
 * the right while the toggle sits there; in the body it does nothing.
 */
export function AdvancedToggle({ toggleRef }: { toggleRef: Ref<HTMLButtonElement> }) {
  return (
    <CollapsibleTrigger
      ref={toggleRef}
      className="mr-auto inline-flex h-control-md w-fit cursor-pointer items-center gap-1.5 rounded-sm text-label text-muted-foreground focus-visible:outline-offset-2"
    >
      {/* The chevron's ink starts ~5px inside its box: pull it onto the labels' edge. Turned, it sits 2px further in. */}
      <DisclosureChevron
        direction="right"
        className="-mr-0.5 -ml-[4.3px] size-icon-md in-aria-expanded:translate-x-[2px]"
      />
      Advanced
    </CollapsibleTrigger>
  );
}

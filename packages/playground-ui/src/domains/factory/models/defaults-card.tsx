import { useState } from 'react';
import type { ReactNode } from 'react';

import { IconTile } from './icon-tile';
import {
  MODEL_DEFAULTS_ANCHORS,
  MODEL_DEFAULTS_ICONS,
  MODEL_DEFAULTS_LABELS,
  MODEL_DEFAULTS_TONES,
  defaultsInUse,
} from './model-routes';
import type { FactoryModelScope, ModelDefaults } from './model-routes';
import { UsedByLanes } from './used-by-lanes';
import { Button } from '@/ds/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';

import { DisclosureChevron } from '@/ds/components/DisclosureChevron';
import { Txt } from '@/ds/components/Txt';
import { SettingsContainer } from '@/ds/new/settings';
import { cn } from '@/utils/cn';

export const DEFAULTS_HEADER_CLASS = 'flex flex-wrap items-center gap-x-3 gap-y-2';
export const DEFAULTS_CONTENT_CLASS = 'flex flex-col gap-3 pt-3';

export function DefaultsIdentity({ defaults, className }: { defaults: ModelDefaults; className?: string }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <IconTile icon={MODEL_DEFAULTS_ICONS[defaults]} className={MODEL_DEFAULTS_TONES[defaults]} />
      <Txt as="h3" variant="label">
        {MODEL_DEFAULTS_LABELS[defaults]}
      </Txt>
    </div>
  );
}

export function DefaultsCard({
  defaults,
  scope,
  packs,
  providers,
  openedByLink = false,
}: {
  defaults: ModelDefaults;
  scope: FactoryModelScope;
  packs: ReactNode;
  providers: ReactNode;
  /** The page was opened on this card's anchor, so start it expanded even when unused. */
  openedByLink?: boolean;
}) {
  const inUse = defaultsInUse(scope, defaults);
  const [expanded, setExpanded] = useState(openedByLink);

  return (
    <SettingsContainer>
      <section
        id={MODEL_DEFAULTS_ANCHORS[defaults]}
        aria-label={MODEL_DEFAULTS_LABELS[defaults]}
        className="scroll-mt-4"
      >
        <Collapsible open={inUse || expanded} onOpenChange={setExpanded}>
          <header className={DEFAULTS_HEADER_CLASS}>
            <DefaultsIdentity defaults={defaults} className={inUse ? undefined : 'opacity-60'} />
            <div className="ml-auto flex items-center gap-2">
              <UsedByLanes scope={scope} defaults={defaults} />
              {!inUse && (
                <CollapsibleTrigger
                  render={
                    <Button variant="ghost" size="sm" iconEnd={<DisclosureChevron />}>
                      Settings
                    </Button>
                  }
                />
              )}
            </div>
          </header>
          <CollapsibleContent className={DEFAULTS_CONTENT_CLASS}>
            {packs}
            <hr className="h-px border-0 bg-border" />
            {providers}
          </CollapsibleContent>
        </Collapsible>
      </section>
    </SettingsContainer>
  );
}

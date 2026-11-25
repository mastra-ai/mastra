import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

import type { FactoryModelScope } from '../../../../workspaces/services/github';
import { MODEL_DEFAULTS_ANCHORS } from '../../../settingsSections';
import { IconTile } from './IconTile';
import { MODEL_DEFAULTS_ICONS, MODEL_DEFAULTS_LABELS, MODEL_DEFAULTS_TONES, defaultsInUse } from './model-routes';
import type { ModelDefaults } from './model-routes';
import { UsedByLanes } from './UsedByLanes';

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
}: {
  defaults: ModelDefaults;
  scope: FactoryModelScope;
  packs: ReactNode;
  providers: ReactNode;
}) {
  const inUse = defaultsInUse(scope, defaults);
  const anchor = MODEL_DEFAULTS_ANCHORS[defaults];
  const openedByLink = useLocation().hash === `#${anchor}`;
  const [expanded, setExpanded] = useState(openedByLink);

  return (
    <SettingsContainer>
      <section id={anchor} aria-label={MODEL_DEFAULTS_LABELS[defaults]} className="scroll-mt-4">
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
            <hr className="border-border1" />
            {providers}
          </CollapsibleContent>
        </Collapsible>
      </section>
    </SettingsContainer>
  );
}

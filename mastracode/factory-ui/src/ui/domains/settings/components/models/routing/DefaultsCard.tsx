import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useState } from 'react';
import type { ReactNode, Ref } from 'react';
import { useLocation } from 'react-router';

import { MODEL_DEFAULTS_ANCHORS } from '../../../settingsSections';
import { IconTile } from './IconTile';
import {
  MODEL_DEFAULTS_ICONS,
  MODEL_DEFAULTS_LABELS,
  MODEL_DEFAULTS_TONES,
  MODEL_DEFAULTS_UNUSED_NOTE,
} from './model-routes';
import type { ModelDefaults } from './model-routes';

export function DefaultsCard({
  defaults,
  inUse,
  anchorRef,
  packs,
  providers,
}: {
  defaults: ModelDefaults;
  inUse: boolean;
  anchorRef?: Ref<HTMLElement>;
  packs: ReactNode;
  providers: ReactNode;
}) {
  const anchor = MODEL_DEFAULTS_ANCHORS[defaults];
  const openedByLink = useLocation().hash === `#${anchor}`;
  const [expanded, setExpanded] = useState(openedByLink);

  return (
    <SettingsContainer>
      <section id={anchor} aria-label={MODEL_DEFAULTS_LABELS[defaults]} className="scroll-mt-4">
        <Collapsible open={inUse || expanded} onOpenChange={setExpanded}>
          <header ref={anchorRef} className="flex items-center gap-3">
            <div className={cn('flex min-w-0 flex-1 items-center gap-3', !inUse && 'opacity-60')}>
              <IconTile icon={MODEL_DEFAULTS_ICONS[defaults]} className={MODEL_DEFAULTS_TONES[defaults]} />
              <div className="flex min-w-0 flex-col">
                <Txt as="h3" variant="label">
                  {MODEL_DEFAULTS_LABELS[defaults]}
                </Txt>
                {!inUse && (
                  <Txt variant="meta" tone="muted">
                    {MODEL_DEFAULTS_UNUSED_NOTE}
                  </Txt>
                )}
              </div>
            </div>
            {!inUse && (
              <CollapsibleTrigger
                render={
                  <Button variant="ghost" size="sm" iconEnd={<DisclosureChevron />}>
                    Settings
                  </Button>
                }
              />
            )}
          </header>
          <CollapsibleContent className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-2">
              <Txt as="span" variant="caption" tone="muted">
                Model packs
              </Txt>
              {packs}
            </div>
            <div className="flex flex-col gap-2">
              <Txt as="span" variant="caption" tone="muted">
                Providers
              </Txt>
              {providers}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>
    </SettingsContainer>
  );
}

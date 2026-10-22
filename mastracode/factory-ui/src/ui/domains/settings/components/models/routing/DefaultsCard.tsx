import { Button } from '@mastra/playground-ui/components/Button';
import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Txt } from '@mastra/playground-ui/components/Txt';
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
  MODEL_DEFAULTS_UNUSED_NOTES,
} from './model-routes';
import type { ModelDefaults } from './model-routes';

export function DefaultsCard({
  defaults,
  inUse,
  anchorRef,
  model,
  providers,
}: {
  defaults: ModelDefaults;
  inUse: boolean;
  anchorRef: Ref<HTMLElement>;
  model: ReactNode;
  providers: ReactNode;
}) {
  const anchor = MODEL_DEFAULTS_ANCHORS[defaults];
  const openedByLink = useLocation().hash === `#${anchor}`;
  const [expanded, setExpanded] = useState(openedByLink);

  return (
    <Card as="section" id={anchor} aria-label={MODEL_DEFAULTS_LABELS[defaults]} className="scroll-mt-4">
      <CardContent>
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
                    {MODEL_DEFAULTS_UNUSED_NOTES[defaults]}
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
            <Field className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2">
              <FieldLabel size="smaller" className="h-control-sm text-muted-foreground">
                Model
              </FieldLabel>
              {model}
            </Field>
            <div className="flex flex-col gap-2">
              <Txt as="span" variant="caption" tone="muted">
                Providers
              </Txt>
              {providers}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

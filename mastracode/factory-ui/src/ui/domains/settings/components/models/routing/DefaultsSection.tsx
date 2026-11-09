import { Button } from '@mastra/playground-ui/components/Button';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

import { MODEL_DEFAULTS_ANCHORS } from '../../../settingsSections';
import type { SettingsScope } from '../../SettingsScope';
import { SettingsSubsection } from '../../SettingsSubsection';
import { MODEL_DEFAULTS_LABELS, MODEL_DEFAULTS_UNUSED_NOTE } from './model-routes';
import type { ModelDefaults } from './model-routes';

const DEFAULTS_SCOPE: Record<ModelDefaults, SettingsScope> = { personal: 'personal', factory: 'factory' };
const OTHER_DEFAULTS: Record<ModelDefaults, ModelDefaults> = { personal: 'factory', factory: 'personal' };

/**
 * One set of defaults: its model rows, then its providers, in one card. Defaults the routing doesn't use fold
 * behind a Settings button, unless a link points at them.
 */
export function DefaultsSection({
  defaults,
  inUse,
  model,
  providers,
}: {
  defaults: ModelDefaults;
  inUse: boolean;
  model: ReactNode;
  providers: ReactNode;
}) {
  const anchor = MODEL_DEFAULTS_ANCHORS[defaults];
  const openedByLink = useLocation().hash === `#${anchor}`;
  const [expanded, setExpanded] = useState(openedByLink);
  const open = inUse || expanded;

  return (
    <SettingsSubsection id={anchor} scope={DEFAULTS_SCOPE[defaults]} title={MODEL_DEFAULTS_LABELS[defaults]}>
      <SettingsContainer>
        {!inUse && (
          <SettingsRow
            label={MODEL_DEFAULTS_UNUSED_NOTE}
            description={`Chats and work-item runs use ${MODEL_DEFAULTS_LABELS[OTHER_DEFAULTS[defaults]]}.`}
          >
            <Button
              variant="ghost"
              size="sm"
              iconEnd={<DisclosureChevron />}
              aria-expanded={expanded}
              onClick={() => setExpanded(current => !current)}
            >
              Settings
            </Button>
          </SettingsRow>
        )}
        {open && model}
        {open && providers}
      </SettingsContainer>
    </SettingsSubsection>
  );
}

import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEffect, useRef } from 'react';

import { CloseIcon } from '../../../ui/icons';
import { useSettingsSection } from '../context/SettingsNavigationProvider';
import { useCloseSettings } from '../hooks/useCloseSettings';
import { SETTINGS_SECTION_LABELS } from '../settingsSections';

type SettingsHeaderProps = {
  autoFocus?: boolean;
  placement: 'mobile' | 'desktop';
};

export function SettingsHeader({ autoFocus = false, placement }: SettingsHeaderProps) {
  const section = useSettingsSection();
  const closeSettings = useCloseSettings();
  const titleRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (autoFocus) titleRef.current?.focus();
  }, [autoFocus]);
  const className =
    placement === 'mobile'
      ? 'flex min-w-0 flex-1 items-center justify-between gap-3'
      : 'mt-6 mb-6 hidden items-center justify-between gap-3 md:flex';

  return (
    <div className={className}>
      <Txt as="h1" variant="header-sm" ref={titleRef} tabIndex={-1} className="text-icon6">
        {SETTINGS_SECTION_LABELS[section]}
      </Txt>
      {placement === 'mobile' && (
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close settings" onClick={closeSettings}>
          <CloseIcon size={16} />
        </Button>
      )}
    </div>
  );
}

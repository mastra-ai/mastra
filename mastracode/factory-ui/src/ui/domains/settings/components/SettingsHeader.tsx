import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEffect, useRef } from 'react';

import { MobilePageTitle } from '../../chat/components/MobilePageTitle';
import { useSettingsSection } from '../hooks/useSettingsSection';
import { SETTINGS_SECTION_LABELS } from '../settingsSections';

type SettingsHeaderProps = {
  autoFocus?: boolean;
  placement: 'mobile' | 'desktop';
};

export function SettingsHeader({ autoFocus = false, placement }: SettingsHeaderProps) {
  const section = useSettingsSection();
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
      {placement === 'mobile' ? (
        <MobilePageTitle ref={titleRef} tabIndex={-1}>
          {SETTINGS_SECTION_LABELS[section]}
        </MobilePageTitle>
      ) : (
        <Txt as="h1" variant="header-sm" ref={titleRef} tabIndex={-1} className="text-icon6">
          {SETTINGS_SECTION_LABELS[section]}
        </Txt>
      )}
    </div>
  );
}

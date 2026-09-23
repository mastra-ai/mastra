import { useEffect, useRef } from 'react';

import { MobilePageTitle } from '../../chat/components/MobilePageTitle';
import { useSettingsSection } from '../hooks/useSettingsSection';
import { SETTINGS_SECTION_LABELS } from '../settingsSections';

export function SettingsHeader({ autoFocus = false }: { autoFocus?: boolean }) {
  const section = useSettingsSection();
  const titleRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (autoFocus) titleRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <MobilePageTitle ref={titleRef} tabIndex={-1}>
        {SETTINGS_SECTION_LABELS[section]}
      </MobilePageTitle>
    </div>
  );
}

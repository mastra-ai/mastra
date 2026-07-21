import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

export type SettingsSection =
  'general' | 'source-control' | 'model' | 'memory' | 'behavior' | 'providers' | 'custom-providers';

const SettingsSectionContext = createContext<SettingsSection | undefined>(undefined);
const SettingsSectionDispatchContext = createContext<Dispatch<SetStateAction<SettingsSection>> | undefined>(undefined);

export function SettingsNavigationProvider({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<SettingsSection>('general');

  return (
    <SettingsSectionContext.Provider value={section}>
      <SettingsSectionDispatchContext.Provider value={setSection}>{children}</SettingsSectionDispatchContext.Provider>
    </SettingsSectionContext.Provider>
  );
}

export function useSettingsSection() {
  const section = useContext(SettingsSectionContext);
  if (section === undefined) throw new Error('useSettingsSection must be used within SettingsNavigationProvider');
  return section;
}

export function useSetSettingsSection() {
  const setSection = useContext(SettingsSectionDispatchContext);
  if (setSection === undefined) throw new Error('useSetSettingsSection must be used within SettingsNavigationProvider');
  return setSection;
}

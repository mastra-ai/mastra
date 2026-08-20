import { SettingsSectionAltDivider } from './settings-section-alt-divider';
import { SettingsSectionAltRoot, type SettingsSectionAltRootProps } from './settings-section-alt-root';
import { SettingsSectionAltRow } from './settings-section-alt-row';

export { type SettingsSectionAltDividerProps } from './settings-section-alt-divider';
export { type SettingsSectionAltRootProps } from './settings-section-alt-root';
export { type SettingsSectionAltRowProps } from './settings-section-alt-row';

export function SettingsSectionAlt(props: SettingsSectionAltRootProps) {
  return <SettingsSectionAltRoot {...props} />;
}

SettingsSectionAlt.Row = SettingsSectionAltRow;
SettingsSectionAlt.Divider = SettingsSectionAltDivider;

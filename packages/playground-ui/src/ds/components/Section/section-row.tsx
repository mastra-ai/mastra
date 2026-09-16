import type { ReactNode } from 'react';
import { SettingsRowLayout } from '@/ds/new/settings/settings-row';
import type { SettingsRowProps } from '@/ds/new/settings/settings-row';

export type SectionRowProps = Omit<SettingsRowProps, 'tone' | 'viewOnly'>;
export type SectionViewOnlyRowProps = SectionRowProps & { children: ReactNode };
export type SectionDestructiveRowProps = SectionRowProps & { children: ReactNode };

/** @deprecated Use SettingsRow from @mastra/playground-ui/new/settings for settings pages. */
export function SectionRow(props: SectionRowProps) {
  return <SettingsRowLayout {...props} layout="section" />;
}

/** @deprecated Use SettingsRow with viewOnly from @mastra/playground-ui/new/settings. */
export function SectionViewOnlyRow(props: SectionViewOnlyRowProps) {
  return <SettingsRowLayout {...props} layout="section" viewOnly />;
}

/** @deprecated Use SettingsRow with tone="destructive" from @mastra/playground-ui/new/settings. */
export function SectionDestructiveRow(props: SectionDestructiveRowProps) {
  return <SettingsRowLayout {...props} layout="section" tone="destructive" />;
}

import type { ComponentProps } from 'react';
import { SettingsContainerLayout } from '@/ds/new/settings/settings-container';

export type SectionContentProps = ComponentProps<'div'>;

export function SectionContent(props: SectionContentProps) {
  return <SettingsContainerLayout {...props} layout="section" />;
}

import { SettingsRowLayout } from '@/ds/new/settings/settings-row';
import type { SettingsRowProps as SharedSettingsRowProps } from '@/ds/new/settings/settings-row';

export type SettingsRowProps = Omit<SharedSettingsRowProps, 'tone' | 'viewOnly'> & {
  variant?: 'default' | 'factory' | null;
};

/** @deprecated Import SettingsRow from @mastra/playground-ui/new/settings. */
export function SettingsRow({ variant, ...props }: SettingsRowProps) {
  return <SettingsRowLayout {...props} layout={variant === 'factory' ? 'factory' : 'standalone'} />;
}

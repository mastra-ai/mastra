import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button';
import { IconSettingsSliderHor } from '@/ds/icons/central/IconSettingsSliderHor';

export function ConnectionManagementButton(props: Omit<ButtonProps, 'variant' | 'size' | 'icon' | 'iconEnd'>) {
  return <Button {...props} variant="default" size="sm" icon={<IconSettingsSliderHor />} />;
}

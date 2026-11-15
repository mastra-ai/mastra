import { Button } from '@mastra/playground-ui/components/Button';
import type { ButtonProps } from '@mastra/playground-ui/components/Button';
import { IconSettingsSliderHor } from '@mastra/playground-ui/icons/central/IconSettingsSliderHor';

export function ConnectionManagementButton(props: Omit<ButtonProps, 'variant' | 'size' | 'icon' | 'iconEnd'>) {
  return <Button {...props} variant="default" size="sm" icon={<IconSettingsSliderHor />} />;
}

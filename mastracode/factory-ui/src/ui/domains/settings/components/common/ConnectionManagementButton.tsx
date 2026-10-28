import { Button } from '@mastra/playground-ui/components/Button';
import type { ButtonProps } from '@mastra/playground-ui/components/Button';
import { Settings2 } from 'lucide-react';

export function ConnectionManagementButton(props: Omit<ButtonProps, 'variant' | 'size' | 'icon' | 'iconEnd'>) {
  return <Button {...props} variant="default" size="sm" icon={<Settings2 />} />;
}

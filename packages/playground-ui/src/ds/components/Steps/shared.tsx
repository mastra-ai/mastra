import { Spinner } from '@/ds/components/Spinner';
import { IconCheckmark1 } from '@/ds/icons/central/IconCheckmark1';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';

export function getStatusIcon(status: string) {
  switch (status) {
    case 'running':
      return <Spinner size="sm" aria-hidden />;
    case 'success':
      return <IconCheckmark1 aria-hidden />;
    case 'failed':
      return <IconCrossMedium aria-hidden />;
    default:
      return null;
  }
}

export type ProcessStep = {
  id: string;
  status: string;
  description: string;
  title: string;
  isActive: boolean;
};

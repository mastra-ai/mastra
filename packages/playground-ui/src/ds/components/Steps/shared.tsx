import { Spinner } from '@/ds/components/Spinner';
import { IconCheckmark2Medium } from '@/ds/icons/central/IconCheckmark2Medium';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';

export function getStatusIcon(status: string) {
  switch (status) {
    case 'running':
      return <Spinner size="sm" aria-hidden />;
    case 'success':
      return <IconCheckmark2Medium aria-hidden />;
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

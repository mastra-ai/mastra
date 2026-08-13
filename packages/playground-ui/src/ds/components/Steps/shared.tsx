import { CheckIcon, XIcon } from 'lucide-react';
import { Spinner } from '@/ds/components/Spinner';

export function getStatusIcon(status: string) {
  switch (status) {
    case 'running':
      return <Spinner size="sm" aria-hidden />;
    case 'success':
      return <CheckIcon aria-hidden />;
    case 'failed':
      return <XIcon aria-hidden />;
    default:
      return null;
  }
}

export type ProcessStep = {
  id: string;
  status: string;
  description: string;
  title: string;
};

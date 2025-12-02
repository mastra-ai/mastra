import { CheckIcon, XIcon } from 'lucide-react';
import Spinner from '../../spinner';

export function getStatusIcon(status: string) {
  switch (status) {
    case 'running':
      return <Spinner />;
    case 'success':
      return <CheckIcon />;
    case 'failed':
      return <XIcon />;
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

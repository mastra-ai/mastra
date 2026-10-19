import type { ExternalToast } from 'sonner';

import { toast } from './toast';

export const wayOutLabels = { docs: 'Docs', support: 'Support' } as const;

export interface ErrorMessage {
  title: string;
  why: string;
  fix: string;
  reassurance?: string;
  wayOut?: { kind: keyof typeof wayOutLabels; href: string };
}

export const errorToast = ({ title, why, fix }: ErrorMessage, options: ExternalToast = {}) =>
  toast.error(title, { ...options, description: `${why} ${fix}` });

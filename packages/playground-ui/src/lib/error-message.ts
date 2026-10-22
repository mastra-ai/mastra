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

const wayOutAction = ({ kind, href }: NonNullable<ErrorMessage['wayOut']>) => ({
  label: `${wayOutLabels[kind]} ↗`,
  onClick: () => window.open(href, '_blank', 'noopener,noreferrer'),
});

export const errorToast = ({ title, why, fix, wayOut }: ErrorMessage, options: ExternalToast = {}) =>
  toast.error(title, {
    ...options,
    action: options.action ?? (wayOut && wayOutAction(wayOut)),
    description: `${why} ${fix}`,
  });

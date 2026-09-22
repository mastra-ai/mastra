import { CircleXIcon } from 'lucide-react';
import { EmptyState } from '@/ds/components/EmptyState';
import type { EmptyStateProps } from '@/ds/components/EmptyState';

export type ErrorStateProps = {
  title: string;
  message: string;
  action?: React.ReactNode;
  variant?: EmptyStateProps['variant'];
};

export function ErrorState({ title, message, action, variant }: ErrorStateProps) {
  return (
    <EmptyState
      iconSlot={<CircleXIcon className="size-8 text-red-900" />}
      titleSlot={title}
      descriptionSlot={message}
      actionSlot={action}
      variant={variant}
    />
  );
}

import { LockIcon } from 'lucide-react';
import { EmptyState } from '@/ds/components/EmptyState';
import type { EmptyStateProps } from '@/ds/components/EmptyState';

export type PermissionDeniedProps = {
  resource: string;
  variant?: EmptyStateProps['variant'];
};

export function PermissionDenied({ resource, variant }: PermissionDeniedProps) {
  return (
    <EmptyState
      variant={variant}
      iconSlot={<LockIcon />}
      titleSlot="Permission Denied"
      descriptionSlot={`You don't have permission to access ${resource}. Contact your administrator for access.`}
    />
  );
}

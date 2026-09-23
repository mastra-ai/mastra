import * as React from 'react';
import { EmptyState } from '@/ds/components/EmptyState';
import type { EmptyStateProps } from '@/ds/components/EmptyState';

export interface PermissionDeniedProps {
  /** Resource type (e.g., "agents", "workflows") */
  resource?: string;
  /** Custom title override */
  title?: string;
  /** Custom description override */
  description?: string;
  /** Optional action slot (e.g., contact admin button) */
  actionSlot?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  variant?: EmptyStateProps['variant'];
}

export function PermissionDenied({
  resource,
  title,
  description,
  actionSlot,
  className,
  variant,
}: PermissionDeniedProps) {
  const defaultTitle = 'Permission Denied';
  const defaultDescription = resource
    ? `You don't have permission to access ${resource}. Contact your administrator for access.`
    : "You don't have permission to access this resource. Contact your administrator for access.";

  return (
    <EmptyState
      className={className}
      variant={variant}
      titleSlot={title ?? defaultTitle}
      descriptionSlot={description ?? defaultDescription}
      actionSlot={actionSlot}
    />
  );
}

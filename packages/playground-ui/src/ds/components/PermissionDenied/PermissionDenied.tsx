import * as React from 'react';
import { ShieldX } from 'lucide-react';
import { EmptyState } from '../EmptyState';
import { Icon } from '../../icons/Icon';

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
}

export function PermissionDenied({ resource, title, description, actionSlot, className }: PermissionDeniedProps) {
  const defaultTitle = 'Permission Denied';
  const defaultDescription = resource
    ? `You don't have permission to access ${resource}. Contact your administrator for access.`
    : "You don't have permission to access this resource. Contact your administrator for access.";

  return (
    <EmptyState
      className={className}
      iconSlot={
        <Icon size="lg" className="text-neutral3">
          <ShieldX />
        </Icon>
      }
      titleSlot={title ?? defaultTitle}
      descriptionSlot={description ?? defaultDescription}
      actionSlot={actionSlot}
    />
  );
}

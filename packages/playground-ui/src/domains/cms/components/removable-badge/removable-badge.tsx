'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import { Badge, type BadgeProps } from '@/ds/components/Badge';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/lib/utils';

export interface RemovableBadgeProps extends Omit<BadgeProps, 'icon'> {
  icon: React.ReactNode;
  onRemove: () => void;
}

export function RemovableBadge({ icon, onRemove, children, className, ...props }: RemovableBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onRemove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn('cursor-pointer', className)}
    >
      <Badge icon={isHovered ? <X /> : icon} {...props}>
        {children}
      </Badge>
    </button>
  );
}

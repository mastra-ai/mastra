import { CircleXIcon } from 'lucide-react';
import type * as React from 'react';

import { Icon } from '../../icons/Icon';
import { EmptyState } from '../EmptyState';

export type ErrorStateProps = {
  title: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
};

export function ErrorState({ title, message, action, className }: ErrorStateProps) {
  return (
    <EmptyState
      className={className}
      iconSlot={
        <Icon size="lg" className="text-negative1">
          <CircleXIcon />
        </Icon>
      }
      titleSlot={title}
      descriptionSlot={message}
      actionSlot={action}
    />
  );
}

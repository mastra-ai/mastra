import type { ComponentPropsWithoutRef } from 'react';
import { ActionRowEnd, ActionRowRoot, ActionRowStart } from '@/ds/components/ActionRow/action-row';
import { cn } from '@/lib/utils';

export type DataListToolbarProps = ComponentPropsWithoutRef<'div'>;

export function DataListToolbar({ className, ...props }: DataListToolbarProps) {
  return <ActionRowRoot data-slot="data-list-toolbar" className={cn('shrink-0 p-1', className)} {...props} />;
}

export const DataListToolbarStart = ActionRowStart;
export const DataListToolbarEnd = ActionRowEnd;

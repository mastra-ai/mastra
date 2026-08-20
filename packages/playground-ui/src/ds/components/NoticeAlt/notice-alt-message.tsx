import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type NoticeAltMessageProps = ComponentPropsWithoutRef<'div'>;

export function NoticeAltMessage({ className, ...props }: NoticeAltMessageProps) {
  return <div className={cn('text-ui-md leading-ui-md text-pretty text-neutral3', className)} {...props} />;
}

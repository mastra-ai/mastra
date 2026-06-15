import { cn } from '@/lib/utils';

export interface NoticeMessageProps {
  children: React.ReactNode;
  className?: string;
}

export function NoticeMessage({ children, className }: NoticeMessageProps) {
  return <div className={cn('text-ui-md leading-ui-md', className)}>{children}</div>;
}

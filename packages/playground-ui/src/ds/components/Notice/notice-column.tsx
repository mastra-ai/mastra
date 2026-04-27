import { cn } from '@/lib/utils';

export interface NoticeMessageProps {
  children: React.ReactNode;
  className?: string;
}

export function NoticeColumn({ children, className }: NoticeMessageProps) {
  return <div className={cn('flex-1 min-w-0 grid gap-1', className)}>{children}</div>;
}

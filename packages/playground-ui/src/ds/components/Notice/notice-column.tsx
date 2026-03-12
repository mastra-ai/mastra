import { cn } from '@/lib/utils';

export interface NoticeMessageProps {
  children: React.ReactNode;
  className?: string;
}

export function NoticeColumn({ children, className }: NoticeMessageProps) {
  return <div className={cn('grid gap-1 ', className)}>{children}</div>;
}

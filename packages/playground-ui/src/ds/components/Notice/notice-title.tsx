import { cn } from '@/lib/utils';

export interface NoticeMessageProps {
  children: React.ReactNode;
  className?: string;
}

export function NoticeTitle({ children, className }: NoticeMessageProps) {
  return <div className={cn('flex-1 text-sm font-semibold', className)}>{children}</div>;
}

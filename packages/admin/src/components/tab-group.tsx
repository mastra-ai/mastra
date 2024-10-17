import { cn } from '@/lib/utils';

export const TabGroup = ({
  className,
  mb,
  children,
}: {
  className?: string;
  mb?: 'large' | 'small';
  children: any;
}) => <div className={cn(mb === 'large' ? 'mb-5' : mb === 'small' ? 'mb-4' : '', className)}>{children}</div>;

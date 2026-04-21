import { cn } from '@/lib/utils';

export type PageHeaderTitleProps = {
  children?: React.ReactNode;
  isLoading?: boolean;
  size?: 'default' | 'smaller';
};

export function PageHeaderTitle({ children, isLoading, size = 'default' }: PageHeaderTitleProps) {
  return (
    <h1
      className={cn(
        'text-neutral5 text-xl font-normal gap-2 flex items-center',
        '[&>svg]:w-[1.25em] [&>svg]:h-[1.25em] [&>svg]:opacity-50',
        {
          'bg-surface4 w-60 max-w-[50%] rounded-md animate-pulse': isLoading,
          'text-md': size === 'smaller',
        },
      )}
    >
      {isLoading ? <>&nbsp;</> : <>{children}</>}
    </h1>
  );
}

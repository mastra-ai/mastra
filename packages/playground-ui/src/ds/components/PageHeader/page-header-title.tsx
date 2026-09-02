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
        'flex items-center gap-2 text-xl font-normal text-(--text-primary)',
        '[&>svg]:size-[1.25em] [&>svg]:opacity-50',
        {
          'bg-surface-hover w-60 max-w-[50%] rounded-md animate-pulse': isLoading,
          'text-md': size === 'smaller',
        },
      )}
    >
      {isLoading ? <>&nbsp;</> : <>{children}</>}
    </h1>
  );
}

import { cn } from '@/lib/utils';

export type MainHeaderTitleProps = {
  children?: React.ReactNode;
  isLoading?: boolean;
  size?: 'default' | 'smaller';
};

export function MainHeaderTitle({ children, isLoading, size = 'default' }: MainHeaderTitleProps) {
  return (
    <h1
      className={cn(
        'flex items-center gap-2 text-xl font-normal text-neutral5',
        '[&>svg]:size-[1.25em] [&>svg]:opacity-50',
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

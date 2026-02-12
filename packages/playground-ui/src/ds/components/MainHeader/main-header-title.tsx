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

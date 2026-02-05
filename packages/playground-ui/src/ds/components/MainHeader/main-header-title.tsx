import { cn } from '@/lib/utils';

export type MainHeaderTitleProps = {
  children?: React.ReactNode;
  isLoading?: boolean;
  size?: 'page' | 'section';
};

export function MainHeaderTitle({ children, isLoading, size = 'page' }: MainHeaderTitleProps) {
  return (
    <h1
      className={cn(
        'text-neutral5 text-2xl font-normal gap-2 flex items-center',
        '[&>svg]:w-[1.25em] [&>svg]:h-[1.25em] [&>svg]:opacity-50',
        {
          'bg-surface4 w-60 max-w-[50%] rounded-md animate-pulse': isLoading,
          'text-xl': size === 'section',
        },
      )}
    >
      {isLoading ? <>&nbsp;</> : <>{children}</>}
    </h1>
  );
}

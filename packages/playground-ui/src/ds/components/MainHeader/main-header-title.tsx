import { cn } from '@/lib/utils';

export type MainHeaderTitleProps = {
  children?: React.ReactNode;
  isLoading?: boolean;
};

export function MainHeaderTitle({ children, isLoading }: MainHeaderTitleProps) {
  return (
    <h1
      className={cn(
        'flex items-center gap-2',
        'text-heading text-foreground',
        '[&>svg]:size-[1.25em] [&>svg]:opacity-50',
        isLoading && 'w-60 max-w-[50%] animate-pulse rounded-md bg-fill',
      )}
    >
      {isLoading ? <>&nbsp;</> : children}
    </h1>
  );
}

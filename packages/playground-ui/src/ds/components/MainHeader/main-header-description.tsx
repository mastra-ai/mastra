import { cn } from '@/lib/utils';

export type MainHeaderDescriptionProps = {
  children?: React.ReactNode;
  isLoading?: boolean;
};

export function MainHeaderDescription({ children, isLoading }: MainHeaderDescriptionProps) {
  return (
    <p
      className={cn(
        'max-w-140 mt-1 ml-1 flex flex-wrap gap-x-4 gap-y-1 first-of-type:mt-3',
        'text-caption text-muted-foreground',
        {
          'w-[40rem] max-w-[80%] animate-pulse rounded-md bg-fill': isLoading,
        },
      )}
    >
      {isLoading ? <>&nbsp;</> : <>{children}</>}
    </p>
  );
}

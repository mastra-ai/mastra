import { cn } from '@/lib/utils';

export type MainHeaderDescriptionProps = {
  children?: React.ReactNode;
  isLoading?: boolean;
};

export function MainHeaderDescription({ children, isLoading }: MainHeaderDescriptionProps) {
  return (
    <p
      className={cn('max-w-140 mt-1 ml-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral3 first-of-type:mt-3', {
        'bg-surface4 w-[40rem] max-w-[80%] rounded-md animate-pulse': isLoading,
      })}
    >
      {isLoading ? <>&nbsp;</> : <>{children}</>}
    </p>
  );
}

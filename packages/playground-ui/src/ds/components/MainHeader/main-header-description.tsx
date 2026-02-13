import { cn } from '@/lib/utils';

export type MainHeaderDescriptionProps = {
  children?: React.ReactNode;
  isLoading?: boolean;
  titleWithIcon?: boolean;
};

export function MainHeaderDescription({ children, isLoading, titleWithIcon }: MainHeaderDescriptionProps) {
  return (
    <p
      className={cn('text-neutral3 text-sm max-w-[35rem] flex flex-wrap gap-x-4 gap-y-1 mt-1 first-of-type:mt-3 ml-1', {
        'bg-surface4 w-[40rem] max-w-[80%] rounded-md animate-pulse': isLoading,
      })}
    >
      {isLoading ? <>&nbsp;</> : <>{children}</>}
    </p>
  );
}

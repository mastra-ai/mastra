import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export type MainHeaderDescriptionProps = {
  children?: React.ReactNode;
  isLoading?: boolean;
};

export function MainHeaderDescription({ children, isLoading }: MainHeaderDescriptionProps) {
  return (
    <Txt
      variant="caption"
      tone="muted"
      className={cn('mt-1 ml-1 flex max-w-140 flex-wrap gap-x-4 gap-y-1 first-of-type:mt-3', {
        'w-[40rem] max-w-[80%] animate-pulse rounded-md bg-fill': isLoading,
      })}
    >
      {isLoading ? <>&nbsp;</> : <>{children}</>}
    </Txt>
  );
}

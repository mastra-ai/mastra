import { cn } from '../../../lib/utils';
import { Txt } from '../Txt';

export type MainHeaderTitleProps = {
  children?: React.ReactNode;
  isLoading?: boolean;
};

export function MainHeaderTitle({ children, isLoading }: MainHeaderTitleProps) {
  return (
    <Txt
      as="h1"
      variant="heading"
      tone="ink"
      className={cn(
        'flex items-center gap-2',
        '[&>svg]:size-[1.25em] [&>svg]:opacity-50',
        isLoading && 'w-60 max-w-[50%] animate-pulse rounded-md bg-fill',
      )}
    >
      {isLoading ? <>&nbsp;</> : children}
    </Txt>
  );
}

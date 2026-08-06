import { cn } from '@/lib/utils';

export type PageHeaderDescriptionProps = {
  children?: React.ReactNode;
  isLoading?: boolean;
};

export function PageHeaderDescription({ children, isLoading }: PageHeaderDescriptionProps) {
  return (
    <p
      className={cn('max-w-140 mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral2', {
        'bg-surface4 w-[40rem] max-w-[80%] rounded-md animate-pulse': isLoading,
      })}
    >
      {isLoading ? <>&nbsp;</> : <>{children}</>}
    </p>
  );
}

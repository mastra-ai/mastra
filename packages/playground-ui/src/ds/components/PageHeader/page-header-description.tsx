import { cn } from '@/lib/utils';

export type PageHeaderDescriptionProps = {
  children?: React.ReactNode;
  isLoading?: boolean;
};

export function PageHeaderDescription({ children, isLoading }: PageHeaderDescriptionProps) {
  return (
    <p
      className={cn('text-neutral2 text-sm max-w-[35rem] flex flex-wrap gap-x-4 gap-y-1 mt-1', {
        'bg-surface4 w-[40rem] max-w-[80%] rounded-md animate-pulse': isLoading,
      })}
    >
      {isLoading ? <>&nbsp;</> : <>{children}</>}
    </p>
  );
}

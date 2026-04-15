import { cn } from '@/lib/utils';

export type DataListNoMatchProps = {
  message?: string;
  className?: string;
};

export function DataListNoMatch({ message = 'Nothing matches your search', className }: DataListNoMatchProps) {
  return (
    <div className={cn('col-span-full flex flex-col items-center justify-center gap-2 py-12 text-neutral3', className)}>
      <p className="text-ui-md">{message}</p>
    </div>
  );
}

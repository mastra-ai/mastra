import { cn } from '@/lib/utils';

type EntryListMessageProps = {
  children?: React.ReactNode;
  message?: string;
  className?: string;
};

export function EntryListMessage({ children, message, className }: EntryListMessageProps) {
  if (!children && !message) {
    return null;
  }

  return (
    <div className={cn('grid border border-border1 border-t-0 bg-surface3 rounded-xl rounded-t-none', className)}>
      <p className="text-icon3 text-[0.875rem] text-center h-[3.5rem] items-center flex justify-center">
        {message ? message : children}
      </p>
    </div>
  );
}

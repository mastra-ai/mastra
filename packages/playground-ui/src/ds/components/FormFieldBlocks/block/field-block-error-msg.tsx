import { TriangleAlertIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FieldBlockErrorMsgProps = {
  children?: React.ReactNode;
};

export function FieldBlockErrorMsg({ children }: FieldBlockErrorMsgProps) {
  return (
    <p
      className={cn(
        'flex items-center gap-2 text-ui-sm text-neutral4',
        '[&>svg]:size-[1.2em] [&>svg]:text-red-400 [&>svg]:opacity-70',
      )}
    >
      <TriangleAlertIcon /> {children}
    </p>
  );
}

import { TriangleAlertIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FieldBlockErrorMsgProps = {
  children?: React.ReactNode;
};

export function FieldBlockErrorMsg({ children }: FieldBlockErrorMsgProps) {
  return (
    <p
      className={cn(
        'text-ui-sm text-neutral4 flex items-center gap-2',
        '[&>svg]:w-[1.2em] [&>svg]:h-[1.2em] [&>svg]:opacity-70 [&>svg]:text-red-400',
      )}
    >
      <TriangleAlertIcon /> {children}
    </p>
  );
}

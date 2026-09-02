import { TriangleAlertIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FieldBlockErrorMsgProps = {
  children?: React.ReactNode;
};

export function FieldBlockErrorMsg({ children }: FieldBlockErrorMsgProps) {
  return (
    <p
      className={cn(
        'flex items-center gap-2 text-ui-sm text-(--text-primary)',
        '[&>svg]:size-[1.2em] [&>svg]:text-error [&>svg]:opacity-70',
      )}
    >
      <TriangleAlertIcon /> {children}
    </p>
  );
}

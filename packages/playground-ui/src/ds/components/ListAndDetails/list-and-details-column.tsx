import { cn } from '@/lib/utils';

export type ListAndDetailsColumnProps = {
  children?: React.ReactNode;
  isTopFixed?: boolean;
};

export function ListAndDetailsColumn({ children, isTopFixed }: ListAndDetailsColumnProps): React.JSX.Element {
  return (
    <div
      className={cn('overflow-y-auto grid gap-6 content-start', {
        'grid-rows-[auto_1fr]': isTopFixed,
      })}
    >
      {children}
    </div>
  );
}

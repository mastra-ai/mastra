import { cn } from '@/lib/utils';
import { ListAndDetails } from './list-and-details';

export type ListAndDetailsListProps = {
  children?: React.ReactNode;
  isTopFixed?: boolean;
};

export function ListAndDetailsList({ children, isTopFixed }: ListAndDetailsListProps): React.JSX.Element {
  return (
    <div
      className={cn('overflow-y-auto grid gap-6 content-start', {
        'grid-rows-[auto_1fr]': isTopFixed,
      })}
      //    style={{ border: '2px dashed red' }}
    >
      {children}
    </div>
  );
}

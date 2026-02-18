import { cn } from '@/lib/utils';
import { ListAndDetails } from './list-and-details';

export type ListAndDetailsColumnProps = {
  children?: React.ReactNode;
  type?: 'list' | 'details' | 'secondDetails';
};

export function ListAndDetailsColumn({ children }: ListAndDetailsColumnProps): React.JSX.Element {
  return (
    <div className="COLUMN flex [&:first-of-type>.SEPARATOR]:hidden overflow-y-auto min-w-[35rem] w-full ">
      <ListAndDetails.Separator className="SEPARATOR" />
      <div
        className={cn('COLUMN-INNER overflow-y-auto grid w-full gap-8 content-start px-[1.5vw]')}
        // style={{ border: '2px dashed gray' }}
      >
        {children}
      </div>
    </div>
  );
}

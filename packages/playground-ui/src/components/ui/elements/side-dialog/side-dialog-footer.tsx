import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/elements/buttons';
import { ArrowDownIcon, ArrowUpIcon, XIcon } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

export type SideDialogFooterProps = {
  children?: React.ReactNode;
  onNext?: (() => void) | null;
  onPrevious?: (() => void) | null;
  showInnerNav?: boolean;
};

export function SideDialogFooter({ children, onNext, onPrevious, showInnerNav }: SideDialogFooterProps) {
  const handleOnNext = () => {
    onNext?.();
  };

  const handleOnPrevious = () => {
    onPrevious?.();
  };

  return (
    <div
      className={cn(
        'flex items-center justify-end gap-[1rem] px-[1.5rem] py-[1rem] min-h-[4rem] border-t border-border1',

        {
          'justify-between': showInnerNav,
        },
      )}
    >
      {(onNext || onPrevious) && showInnerNav && (
        <div className={cn('flex gap-[1rem]')}>
          <Dialog.Close asChild>
            <Button onClick={handleOnNext} disabled={!onNext} variant="ghost">
              <XIcon />
              Close
            </Button>
          </Dialog.Close>
          <Button onClick={handleOnNext} disabled={!onNext} variant="ghost">
            Next
            <ArrowUpIcon />
          </Button>
          <Button onClick={handleOnPrevious} disabled={!onPrevious} variant="ghost">
            <ArrowDownIcon />
            Previous
          </Button>
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}

export function SideDialogFooterGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-baseline gap-[1rem]">{children}</div>;
}

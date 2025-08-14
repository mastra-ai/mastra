import { Button } from '@/components/ui/elements/buttons';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

export type SideDialogTopProps = {
  children?: React.ReactNode;
  onNext?: (() => void) | null;
  onPrevious?: (() => void) | null;
  showInnerNav?: boolean;
};

export function SideDialogTop({ children, onNext, onPrevious, showInnerNav }: SideDialogTopProps) {
  const handleOnNext = () => {
    onNext?.();
  };

  const handleOnPrevious = () => {
    onPrevious?.();
  };

  return (
    <div className={cn(`flex justify-between h-[3.5rem] items-center  text-icon5 text-[.875rem] pl-[1.5rem]`)}>
      <div className={cn('flex items-center gap-[2rem]', '[&_svg]:w-[1.1em] [&_svg]:h-[1.1em] [&_svg]:text-icon3')}>
        {children}

        {(onNext || onPrevious) && showInnerNav && (
          <>
            <span className="text-icon3">|</span>
            <div
              className={cn(
                'flex gap-[1rem] items-baseline',
                // '[&>button]:text-[0.875rem] [&>button]:flex [&>button]:items-center [&>button]:px-[0.5rem] [&>button]:py-[0.8rem] [&>button]:leading-[1]',
              )}
            >
              <Button onClick={handleOnNext} disabled={!onNext} variant="ghost">
                Next
                <ArrowUpIcon />
              </Button>
              <Button onClick={handleOnPrevious} disabled={!onPrevious} variant="ghost">
                Previous
                <ArrowDownIcon />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

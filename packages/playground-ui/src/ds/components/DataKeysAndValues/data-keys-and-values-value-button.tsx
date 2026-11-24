import { dataKeysAndValuesValueStyles } from './shared';
import { IconChainLink3 } from '@/ds/icons/central/IconChainLink3';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface DataKeysAndValuesValueButtonProps {
  className?: string;
  children: React.ReactNode;
  /** What opening the value does: the host decides where it goes. */
  onClick: () => void;
}

/** A value that opens something, drawn like `ValueLink` but acting through a callback instead of an href. */
export function DataKeysAndValuesValueButton({ className, children, onClick }: DataKeysAndValuesValueButtonProps) {
  return (
    <dd className={cn(dataKeysAndValuesValueStyles, className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex items-center gap-2 truncate text-left hover:text-foreground',
          controlStateColorTransition,
          '[&:hover>svg]:opacity-100 [&>svg]:size-icon-md [&>svg]:shrink-0 [&>svg]:opacity-70',
        )}
      >
        <span>{children}</span>
        <IconChainLink3 />
      </button>
    </dd>
  );
}

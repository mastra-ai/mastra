import { InputField, type InputFieldProps } from './input-field';
import { cn } from '@/lib/utils';
import { SearchIcon, XIcon } from 'lucide-react';
import { transitions } from '@/ds/primitives/transitions';
import { Button } from '../Button';

export type SearchFieldProps = InputFieldProps & {
  onReset?: () => void;
};

export function SearchField({ onReset, variant, ...props }: SearchFieldProps) {
  return (
    <div className={cn('relative group')}>
      <InputField labelIsHidden={true} {...props} className={cn('[&>input]:pl-10 relative', {})} variant={variant} />

      <SearchIcon
        aria-hidden="true"
        className="text-neutral4 opacity-50 group-has-[:focus]:opacity-100 absolute top-2 left-3 w-5 h-5"
      />

      {onReset && props.value && (
        <>
          {variant === 'new' ? (
            <Button
              type="button"
              onClick={onReset}
              variant="standard"
              size="sm"
              className="absolute top-[50%] translate-y-[-50%] rounded-none right-[2px] w-[2rem] h-[calc(100%-4px)] px-0"
              aria-label="Clear"
            >
              <XIcon />
            </Button>
          ) : (
            <button
              type="button"
              onClick={onReset}
              className={cn(
                'absolute top-1/2 right-2 -translate-y-1/2 p-1 rounded',
                transitions.all,
                'hover:bg-surface4',
                '[&>svg]:transition-colors [&>svg]:duration-normal',
                '[&:hover>svg]:text-neutral5',
              )}
            >
              <XIcon className="text-neutral3 w-[1rem] h-[1rem]" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

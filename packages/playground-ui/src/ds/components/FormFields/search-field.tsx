import { InputField, type InputFieldProps } from './input-field';
import { cn } from '@/lib/utils';
import { XIcon } from 'lucide-react';
import { transitions } from '@/ds/primitives/transitions';

export type SearchFieldProps = InputFieldProps & {
  onReset?: () => void;
};

export function SearchField({ onReset, ...props }: SearchFieldProps) {
  return (
    <div className="relative">
      <InputField
        labelIsHidden={true}
        {...props}
        className="[&>input]:pl-10"
        style={{
          background: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='gray' viewBox='0 0 24 24'><path d='M21 20l-5.6-5.6a7 7 0 1 0-1.4 1.4L20 21zM4 10a6 6 0 1 1 12 0 6 6 0 0 1-12 0z'/></svg>") no-repeat 8px center`,
          backgroundSize: '1.5rem 1.5rem',
          paddingRight: onReset ? '3rem' : undefined,
        }}
      />

      {onReset && props.value && (
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
    </div>
  );
}

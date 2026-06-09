import { Txt, cn } from '@mastra/playground-ui';
import { Braces, FormInput } from 'lucide-react';

export type WorkflowInputType = 'simple' | 'form' | 'json';

interface InputTypeOption {
  value: WorkflowInputType;
  label: string;
  icon?: React.ReactNode;
}

export interface WorkflowInputTypeToggleProps {
  value: WorkflowInputType;
  onChange: (value: WorkflowInputType) => void;
  disabled?: boolean;
  includeSimple?: boolean;
}

export function WorkflowInputTypeToggle({ value, onChange, disabled, includeSimple }: WorkflowInputTypeToggleProps) {
  const options: InputTypeOption[] = [
    ...(includeSimple ? [{ value: 'simple' as const, label: 'Simple' }] : []),
    { value: 'form', label: 'Form', icon: <FormInput className="h-4 w-4" /> },
    { value: 'json', label: 'JSON', icon: <Braces className="h-4 w-4" /> },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Input type"
      className="grid w-full grid-flow-col auto-cols-fr gap-1 rounded-lg border border-border1 bg-surface3 p-1"
    >
      {options.map(option => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={option.label}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-md px-3 py-1.5 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent1',
              isActive ? 'bg-surface5 text-neutral5' : 'text-neutral3 hover:text-neutral4',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {option.icon}
            <Txt as="span" variant="ui-sm">
              {option.label}
            </Txt>
          </button>
        );
      })}
    </div>
  );
}

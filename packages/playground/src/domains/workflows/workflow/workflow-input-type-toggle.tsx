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
  compact?: boolean;
}

export function WorkflowInputTypeToggle({
  value,
  onChange,
  disabled,
  includeSimple,
  compact,
}: WorkflowInputTypeToggleProps) {
  const iconClassName = compact ? 'h-3 w-3' : 'h-4 w-4';
  const options: InputTypeOption[] = [
    ...(includeSimple ? [{ value: 'simple' as const, label: 'Simple' }] : []),
    { value: 'form', label: 'Form', icon: <FormInput className={iconClassName} /> },
    { value: 'json', label: 'JSON', icon: <Braces className={iconClassName} /> },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Input type"
      className={cn(
        'grid grid-flow-col auto-cols-fr gap-1 border border-border1 bg-surface3',
        compact ? 'h-5 w-auto rounded-md p-0.5' : 'w-full rounded-lg p-1',
      )}
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
              'flex items-center justify-center rounded-md transition-colors',
              compact ? 'gap-0.5 px-1 py-0' : 'gap-2 px-3 py-1.5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent1',
              isActive ? 'bg-surface5 text-neutral5' : 'text-neutral3 hover:text-neutral4',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {option.icon}
            <Txt as="span" variant={compact ? 'ui-xs' : 'ui-sm'}>
              {option.label}
            </Txt>
          </button>
        );
      })}
    </div>
  );
}

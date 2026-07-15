import { cn } from '@/lib/utils';

export type FieldBlockLabelProps = {
  children: React.ReactNode;
  name: string;
  required?: boolean;
  size?: 'default' | 'bigger';
  className?: string;
};

export function FieldBlockLabel({ children, name, required, size = 'default', className }: FieldBlockLabelProps) {
  return (
    <label
      htmlFor={`input-${name}`}
      className={cn(
        'flex items-center justify-between text-ui-smd text-neutral3 ',
        'in-[.horizontal-field-block]:grid in-[.horizontal-field-block]:content-start',
        {
          'text-ui-md': size === 'bigger',
        },
        className,
      )}
    >
      {children}
      {required && <i className="text-xs text-neutral2">(required)</i>}
    </label>
  );
}

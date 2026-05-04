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
        'text-ui-smd text-neutral3 flex justify-between items-center ',
        'in-[.horizontal-field-block]:grid in-[.horizontal-field-block]:content-start',
        {
          'text-ui-md': size === 'bigger',
        },
        className,
      )}
    >
      {children}
      {required && <i className="text-neutral2 text-xs">(required)</i>}
    </label>
  );
}

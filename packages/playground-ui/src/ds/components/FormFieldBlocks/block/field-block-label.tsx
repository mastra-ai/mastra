import { cn } from '@/lib/utils';

export type FieldBlockLabelProps = {
  children: React.ReactNode;
  name: string;
  htmlFor?: string;
  required?: boolean;
  disabled?: boolean;
  size?: 'default' | 'bigger';
  className?: string;
};

export function FieldBlockLabel({
  children,
  name,
  htmlFor = `input-${name}`,
  required,
  disabled = false,
  size = 'default',
  className,
}: FieldBlockLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'inline-flex items-center text-label',
        {
          'text-body': size === 'bigger',
          'text-foreground': !disabled,
          'text-muted-foreground': disabled,
        },
        className,
      )}
    >
      {children}
      {required ? (
        <>
          <span aria-hidden className={cn('ml-0.5', disabled ? 'text-muted-foreground' : 'text-destructive')}>
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
      ) : null}
    </label>
  );
}

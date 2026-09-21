import '../../../../../new-theme.css';
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
      // A field label is secondary text describing its control, so it sits at `ui-sm`.
      // `bigger` promotes it to body size for a field that leads a section.
      className={cn(
        'new-theme flex items-center justify-between text-ui-sm text-muted-foreground',
        'in-[.horizontal-field-block]:grid in-[.horizontal-field-block]:content-start',
        {
          'text-ui-md': size === 'bigger',
        },
        className,
      )}
    >
      {children}
      {/* Metadata beside the label, so `ui-xs`. Not italic: italic marks citations and
          linguistic stress, and reads as emphasis the label does not intend. */}
      {required && <span className="text-ui-xs text-muted-foreground">(required)</span>}
    </label>
  );
}

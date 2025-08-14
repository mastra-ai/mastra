import { Button } from '@/components/ui/elements/buttons';
import { cn } from '@/lib/utils';

type FormActionsProps = {
  children?: React.ReactNode;
  onSubmit?: () => void;
  onCancel?: () => void;
  className?: string;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  variant?: 'toLeft' | 'toRight' | 'stretch';
};

export function FormActions({
  children,
  onSubmit,
  onCancel,
  className,
  submitLabel,
  cancelLabel,
  isSubmitting,
  variant = 'toLeft',
}: FormActionsProps) {
  if (!children && (!onSubmit || !onCancel)) {
    console.warn('FormActions requires either children or onSubmit and onCancel props');
    return null;
  }

  return (
    <div
      className={cn(
        'flex gap-[1rem] items-center justify-start',
        { 'justify-end': variant === 'toRight', 'grid w-full grid-cols-[1fr_auto]': variant === 'stretch' },
        className,
      )}
    >
      {children ? (
        children
      ) : (
        <>
          <Button onClick={onSubmit} className="min-w-[12rem]" disabled={isSubmitting} variant="primary">
            {submitLabel || 'Submit'}
          </Button>
          <Button onClick={onCancel}>{cancelLabel || 'Cancel'}</Button>
        </>
      )}
    </div>
  );
}

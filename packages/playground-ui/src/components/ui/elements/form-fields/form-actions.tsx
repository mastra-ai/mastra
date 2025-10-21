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
};

export function FormActions({
  children,
  onSubmit,
  onCancel,
  className,
  submitLabel,
  cancelLabel,
  isSubmitting,
}: FormActionsProps) {
  if (!children && (!onSubmit || !onCancel)) {
    console.warn('FormActions requires either children or onSubmit and onCancel props');
    return null;
  }

  return (
    <div className={cn('flex gap-[1rem] items-center justify-start', className)}>
      {children ? (
        children
      ) : (
        <>
          <Button onClick={onSubmit} className="px-[3rem]" disabled={isSubmitting} variant="primary">
            {submitLabel || 'Submit'}
          </Button>
          <Button onClick={onCancel}>{cancelLabel || 'Cancel'}</Button>
        </>
      )}
    </div>
  );
}

import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/utils/cn';

export type FormSubmitRowProps = {
  isSubmitLoading?: boolean;
  submitButtonLabel?: string;
  submitButtonIcon?: ReactNode;
  submitButtonVariant?: ButtonProps['variant'];
  submitButtonFullWidth?: boolean;
  submitActions?: ReactNode;
  leftActions?: ReactNode;
  onSubmit?: () => void;
  children?: ReactNode;
};

export const FormSubmitRow = ({
  isSubmitLoading,
  submitButtonLabel,
  submitButtonIcon,
  submitButtonVariant,
  submitButtonFullWidth,
  submitActions,
  leftActions,
  onSubmit,
  children,
}: FormSubmitRowProps) => (
  <div
    data-slot="form-submit-row"
    className={cn('flex items-center justify-between gap-1', submitButtonFullWidth && 'block')}
  >
    {!submitButtonFullWidth && (leftActions ?? <div />)}
    <div className={cn('flex items-center gap-1', submitButtonFullWidth && 'w-full')}>
      {submitActions}
      <Button
        type={onSubmit ? 'button' : 'submit'}
        variant={submitButtonVariant}
        onClick={onSubmit}
        disabled={isSubmitLoading}
        className={cn(submitButtonFullWidth && 'w-full justify-center')}
      >
        {isSubmitLoading ? (
          <Icon>
            <Loader2 className="animate-spin" />
          </Icon>
        ) : (
          submitButtonIcon
        )}
        {submitButtonLabel || children}
      </Button>
    </div>
  </div>
);

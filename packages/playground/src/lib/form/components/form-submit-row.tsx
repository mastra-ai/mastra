import { Button } from '@mastra/playground-ui/components/Button';
import type { ButtonProps } from '@mastra/playground-ui/components/Button';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

export type FormSubmitRowProps = {
  isSubmitLoading?: boolean;
  submitButtonLabel?: string;
  disableSubmit?: boolean;
  submitButtonClassName?: string;
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
  disableSubmit,
  submitButtonClassName,
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
        disabled={isSubmitLoading || disableSubmit}
        className={cn(submitButtonFullWidth && 'w-full justify-center', submitButtonClassName)}
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

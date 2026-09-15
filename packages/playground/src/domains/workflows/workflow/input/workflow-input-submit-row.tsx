import { Button } from '@mastra/playground-ui/components/Button';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Loader2, Play } from 'lucide-react';
import type { WorkflowInputDataProps } from '../workflow-input-data';

type WorkflowSubmitRowProps = Pick<
  WorkflowInputDataProps,
  | 'isSubmitLoading'
  | 'submitButtonLabel'
  | 'submitActions'
  | 'leftActions'
  | 'submitButtonIcon'
  | 'submitButtonVariant'
  | 'submitButtonFullWidth'
> & {
  onSubmit: () => void;
};

export const WorkflowSubmitRow = ({
  isSubmitLoading,
  submitButtonLabel,
  submitActions,
  leftActions,
  submitButtonIcon,
  submitButtonVariant,
  submitButtonFullWidth,
  onSubmit,
}: WorkflowSubmitRowProps) => (
  <div
    data-slot="form-submit-row"
    className={cn('flex items-center justify-between gap-1', submitButtonFullWidth && 'block')}
  >
    {!submitButtonFullWidth && (leftActions ?? <div />)}
    <div className={cn('flex items-center gap-1', submitButtonFullWidth && 'w-full')}>
      {submitActions}
      <Button
        variant={submitButtonVariant ?? 'primary'}
        onClick={onSubmit}
        disabled={isSubmitLoading}
        className={cn(submitButtonFullWidth && 'w-full justify-center')}
      >
        {isSubmitLoading ? (
          <Icon>
            <Loader2 className="animate-spin" />
          </Icon>
        ) : (
          (submitButtonIcon ?? (
            <Icon>
              <Play />
            </Icon>
          ))
        )}
        {submitButtonLabel}
      </Button>
    </div>
  </div>
);

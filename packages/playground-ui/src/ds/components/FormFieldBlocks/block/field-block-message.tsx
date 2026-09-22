import '../../../../../new-theme.css';
import { FieldBlockErrorMsg } from './field-block-error-msg';
import { FieldBlockHelpText } from './field-block-help-text';

export type FieldBlockMessageProps = {
  name: string;
  helpText?: React.ReactNode;
  errorMsg?: React.ReactNode;
};

export function FieldBlockMessage({ name, helpText, errorMsg }: FieldBlockMessageProps) {
  return (
    <div className="new-theme text-ui-sm h-[1lh] min-w-0 overflow-hidden [&>p]:truncate">
      {errorMsg ? (
        <FieldBlockErrorMsg name={name} className="truncate">
          {errorMsg}
        </FieldBlockErrorMsg>
      ) : helpText ? (
        <FieldBlockHelpText>{helpText}</FieldBlockHelpText>
      ) : null}
    </div>
  );
}

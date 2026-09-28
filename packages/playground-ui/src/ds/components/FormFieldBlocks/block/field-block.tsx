import { FieldBlockErrorMsg } from './field-block-error-msg';
import { FieldBlockHelpText } from './field-block-help-text';
import { FieldBlockLabel } from './field-block-label';
import { FieldBlockRoot } from './field-block-root';

export type { FieldBlockProps, FieldControlProps } from './field-block-root';

export const FieldBlock = Object.assign(FieldBlockRoot, {
  Label: FieldBlockLabel,
  HelpText: FieldBlockHelpText,
  ErrorMsg: FieldBlockErrorMsg,
});

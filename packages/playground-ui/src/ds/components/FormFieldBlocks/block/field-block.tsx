import { FieldBlockColumn } from './field-block-column';
import { FieldBlockErrorMsg } from './field-block-error-msg';
import { FieldBlockHelpText } from './field-block-help-text';
import { FieldBlockLabel } from './field-block-label';
import { FieldBlockLayout } from './field-block-layout';

export const FieldBlock = Object.assign(
  {},
  {
    Layout: FieldBlockLayout,
    Column: FieldBlockColumn,
    Label: FieldBlockLabel,
    HelpText: FieldBlockHelpText,
    ErrorMsg: FieldBlockErrorMsg,
  },
);

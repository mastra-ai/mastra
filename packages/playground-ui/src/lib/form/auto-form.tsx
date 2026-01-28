import React from 'react';
import { AutoFormUIComponents } from '@autoform/react';
import { AutoFormProps } from './types';
import { Form } from './components/form';
import { FieldWrapper } from './components/field-wrapper';
import { ErrorMessage } from './components/error-message';
import { SubmitButton } from './components/submit-button';
import { StringField } from './components/string-field';
import { NumberField } from './components/number-field';
import { BooleanField } from './components/boolean-field';
import { DateField } from './components/date-field';
import { SelectField } from './components/select-field';
import { ObjectWrapper } from './components/object-wrapper';
import { ArrayWrapper } from './components/array-wrapper';
import { ArrayElementWrapper } from './components/array-element-wrapper';
import { RecordField } from './components/record-field';
import { UnionField } from './components/union-field';
import { DiscriminatedUnionField } from './components/discriminated-union-field';
import { CustomAutoForm } from './custom-auto-form';

const ShadcnUIComponents: AutoFormUIComponents = {
  Form,
  FieldWrapper,
  ErrorMessage,
  SubmitButton,
  ObjectWrapper,
  ArrayWrapper,
  ArrayElementWrapper,
};

export const ShadcnAutoFormFieldComponents = {
  string: StringField,
  number: NumberField,
  boolean: BooleanField,
  date: DateField,
  select: SelectField,
  record: RecordField,
};
export type FieldTypes = keyof typeof ShadcnAutoFormFieldComponents;

export function AutoForm<T extends Record<string, any>>({
  uiComponents,
  formComponents,
  readOnly,
  ...props
}: AutoFormProps<T> & { readOnly?: boolean }) {
  return (
    <CustomAutoForm
      {...props}
      uiComponents={{ ...ShadcnUIComponents, ...uiComponents }}
      formComponents={{
        string: props => <StringField {...props} inputProps={{ ...props.inputProps, readOnly }} />,
        number: props => <NumberField {...props} inputProps={{ ...props.inputProps, readOnly }} />,
        boolean: props => <BooleanField {...props} inputProps={{ ...props.inputProps, readOnly }} />,
        date: props => <DateField {...props} inputProps={{ ...props.inputProps, readOnly }} />,
        select: props => <SelectField {...props} inputProps={{ ...props.inputProps, readOnly }} />,
        record: props => <RecordField {...props} inputProps={{ ...props.inputProps, readOnly }} />,
        union: props => <UnionField {...props} inputProps={{ ...props.inputProps, readOnly }} />,
        'discriminated-union': props => (
          <DiscriminatedUnionField {...props} inputProps={{ ...props.inputProps, readOnly }} />
        ),
        ...formComponents,
      }}
    />
  );
}

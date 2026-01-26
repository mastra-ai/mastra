import React, { useMemo } from 'react';
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
  // Memoize UI components to prevent unnecessary re-renders
  const mergedUiComponents = useMemo(() => ({ ...ShadcnUIComponents, ...uiComponents }), [uiComponents]);

  // Memoize form components with readOnly prop to prevent focus loss on re-renders
  const mergedFormComponents = useMemo(
    () => ({
      string: (fieldProps: any) => <StringField {...fieldProps} inputProps={{ ...fieldProps.inputProps, readOnly }} />,
      number: (fieldProps: any) => <NumberField {...fieldProps} inputProps={{ ...fieldProps.inputProps, readOnly }} />,
      boolean: (fieldProps: any) => (
        <BooleanField {...fieldProps} inputProps={{ ...fieldProps.inputProps, readOnly }} />
      ),
      date: (fieldProps: any) => <DateField {...fieldProps} inputProps={{ ...fieldProps.inputProps, readOnly }} />,
      select: (fieldProps: any) => <SelectField {...fieldProps} inputProps={{ ...fieldProps.inputProps, readOnly }} />,
      record: (fieldProps: any) => <RecordField {...fieldProps} inputProps={{ ...fieldProps.inputProps, readOnly }} />,
      union: (fieldProps: any) => <UnionField {...fieldProps} inputProps={{ ...fieldProps.inputProps, readOnly }} />,
      'discriminated-union': (fieldProps: any) => (
        <DiscriminatedUnionField {...fieldProps} inputProps={{ ...fieldProps.inputProps, readOnly }} />
      ),
      ...formComponents,
    }),
    [readOnly, formComponents],
  );

  return <CustomAutoForm {...props} uiComponents={mergedUiComponents} formComponents={mergedFormComponents} />;
}

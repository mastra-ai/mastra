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
  // Only merge readOnly when explicitly set (not undefined) to preserve field-level settings
  const mergedFormComponents = useMemo(() => {
    const mergeInputProps = (inputProps?: Record<string, unknown>) =>
      readOnly === undefined ? inputProps : { ...inputProps, readOnly };

    return {
      string: (fieldProps: any) => <StringField {...fieldProps} inputProps={mergeInputProps(fieldProps.inputProps)} />,
      number: (fieldProps: any) => <NumberField {...fieldProps} inputProps={mergeInputProps(fieldProps.inputProps)} />,
      boolean: (fieldProps: any) => (
        <BooleanField {...fieldProps} inputProps={mergeInputProps(fieldProps.inputProps)} />
      ),
      date: (fieldProps: any) => <DateField {...fieldProps} inputProps={mergeInputProps(fieldProps.inputProps)} />,
      select: (fieldProps: any) => <SelectField {...fieldProps} inputProps={mergeInputProps(fieldProps.inputProps)} />,
      record: (fieldProps: any) => <RecordField {...fieldProps} inputProps={mergeInputProps(fieldProps.inputProps)} />,
      union: (fieldProps: any) => <UnionField {...fieldProps} inputProps={mergeInputProps(fieldProps.inputProps)} />,
      'discriminated-union': (fieldProps: any) => (
        <DiscriminatedUnionField {...fieldProps} inputProps={mergeInputProps(fieldProps.inputProps)} />
      ),
      ...formComponents,
    };
  }, [readOnly, formComponents]);

  return <CustomAutoForm {...props} uiComponents={mergedUiComponents} formComponents={mergedFormComponents} />;
}

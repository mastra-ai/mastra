import type { IntegrationFieldType } from '@arkw/core/dist/types';
import { Controller } from 'react-hook-form';

import { FieldProps, FormConfigType } from '../../schema';
import { IntegrationFieldTypeEnum } from '../../types';
import CheckboxField from '../workflow-sidebar/config-forms/checkbox-field';
import CreatableSelect from '../workflow-sidebar/config-forms/creatable-select';
import DateField from '../workflow-sidebar/config-forms/date-field';
import MultiSelect from '../workflow-sidebar/config-forms/multi-select';
import NumberField from '../workflow-sidebar/config-forms/number-field';
import SingleSelect from '../workflow-sidebar/config-forms/single-select';
import TextArea from '../workflow-sidebar/config-forms/text-area';
import TextField from '../workflow-sidebar/config-forms/text-field';

export function getWorkflowFormFieldMap(
  { canUseVariables, fieldFromDescription }: { canUseVariables: boolean; fieldFromDescription?: string } = {
    canUseVariables: false,
    fieldFromDescription: '',
  },
) {
  if (fieldFromDescription === IntegrationFieldTypeEnum.COMPOSITE) return;
  return {
    [FormConfigType.STRING]: (props: FieldProps) => {
      const { handleFieldChange, variables, options, ...rest } = props;

      if (options) {
        return renderSpecialField({
          fieldType: IntegrationFieldTypeEnum.SINGLE_SELECT,
          canUseVariables,
          props,
        });
      }

      if (fieldFromDescription as IntegrationFieldType) {
        return renderSpecialField({
          fieldType: fieldFromDescription as IntegrationFieldType,
          canUseVariables,
          props,
        });
      }
      return (
        <Controller
          {...rest}
          render={({ field }) => (
            <TextField
              field={field}
              canUseVariables={canUseVariables}
              initialVariables={variables?.[field.name]}
              onBlur={handleFieldChange}
            />
          )}
        />
      );
    },
    [FormConfigType.NUMBER]: (props: FieldProps) => {
      const { handleFieldChange, variables, ...rest } = props;
      return <Controller {...rest} render={({ field }) => <NumberField field={field} onBlur={handleFieldChange} />} />;
    },
    [FormConfigType.DATE]: (props: FieldProps) => {
      const { handleFieldChange, name, control, ...rest } = props;
      return (
        <Controller
          {...rest}
          name={name}
          control={control}
          render={({ field }) => (
            <DateField
              field={field}
              value={field.value ? new Date(field.value) : undefined}
              onChange={handleFieldChange}
            />
          )}
        />
      );
    },
    [FormConfigType.BOOLEAN]: (props: FieldProps) => {
      const { handleFieldChange, name, control, ...rest } = props;
      return (
        <Controller
          {...rest}
          name={name}
          control={control}
          render={({ field }) => (
            <CheckboxField field={field} value={field.value} onChange={handleFieldChange} type="boolean" />
          )}
        />
      );
    },
    [FormConfigType.ENUM]: (props: FieldProps) => {
      const { handleFieldChange, options, control, name, variables, ...rest } = props;

      if (fieldFromDescription as IntegrationFieldType) {
        return renderSpecialField({
          fieldType: fieldFromDescription as IntegrationFieldType,
          canUseVariables,
          props,
        });
      }

      return (
        <Controller
          {...rest}
          name={name}
          control={control}
          render={({ field }) => (
            <SingleSelect
              field={field}
              initialVariables={variables?.[field.name]}
              selected={field.value}
              options={options || []}
              onSelect={handleFieldChange}
              canUseVariables={canUseVariables}
            />
          )}
        />
      );
    },
    [FormConfigType.ARRAY]: (props: FieldProps) => {
      const { handleFieldChange, options, control, name, variables, ...rest } = props;

      if (fieldFromDescription as IntegrationFieldType) {
        return renderSpecialField({
          fieldType: fieldFromDescription as IntegrationFieldType,
          canUseVariables,
          props,
        });
      }

      return (
        <Controller
          {...rest}
          name={name}
          control={control}
          render={({ field }) => (
            <MultiSelect
              field={field}
              selected={field.value}
              options={options || []}
              onSelect={handleFieldChange}
              canUseVariables={canUseVariables}
              initialVariables={variables?.[field.name]}
            />
          )}
        />
      );
    },
  };
}

function renderSpecialField({
  fieldType,
  canUseVariables,
  props,
}: {
  fieldType: IntegrationFieldType;
  props: FieldProps;
  canUseVariables: boolean;
}) {
  const { handleFieldChange, variables, options, ...rest } = props;
  switch (fieldType) {
    case IntegrationFieldTypeEnum.CHECKBOX:
      return (
        <Controller
          {...rest}
          render={({ field }) => (
            <CheckboxField field={field} value={field.value} onChange={handleFieldChange} type="check" />
          )}
        />
      );
    case IntegrationFieldTypeEnum.SINGLE_SELECT:
      return (
        <Controller
          {...rest}
          render={({ field }) => (
            <SingleSelect
              initialVariables={variables?.[field.name]}
              canUseVariables={canUseVariables}
              field={field}
              selected={field.value}
              options={options || []}
              onSelect={handleFieldChange}
            />
          )}
        />
      );
    case IntegrationFieldTypeEnum.LONG_TEXT:
      return (
        <Controller
          {...rest}
          render={({ field }) => (
            <TextArea
              field={field}
              canUseVariables={canUseVariables}
              initialVariables={variables?.[field.name]}
              onBlur={handleFieldChange}
            />
          )}
        />
      );
    case IntegrationFieldTypeEnum.MULTI_SELECT:
      return (
        <Controller
          {...rest}
          render={({ field }) => (
            <MultiSelect
              field={field}
              selected={field.value}
              options={options || []}
              onSelect={handleFieldChange}
              canUseVariables={canUseVariables}
              initialVariables={variables?.[field.name]}
            />
          )}
        />
      );
    case IntegrationFieldTypeEnum.CREATABLE_SELECT:
      return (
        <CreatableSelect
          control={props.control}
          name={props.name}
          setValue={(key, value) => {
            handleFieldChange({ key, value });
          }}
        />
      );
    default:
      return (
        <Controller
          {...rest}
          render={({ field }) => (
            <TextField
              field={field}
              canUseVariables={canUseVariables}
              initialVariables={variables?.[field.name]}
              onBlur={handleFieldChange}
            />
          )}
        />
      );
  }
}

import * as z from 'zod';

import {
  ArrayField,
  BooleanField,
  CreatableField,
  DateField,
  EnumField,
  NumberField,
  RecordField,
  StringField,
  ObjectField,
  UnionField,
} from './fields';
import { FormConfigType, getFormConfigTypesFromSchemaDef } from './schema';
import type { FieldProps } from './schema';
import { resolveSchema } from './schema-resolver';

export function getDefaultFieldMap() {
  return {
    [FormConfigType.STRING]: (props: FieldProps) => {
      const { options, ...rest } = props;
      if (options?.length) {
        return <EnumField {...rest} options={options} />;
      }
      return <StringField {...rest} />;
    },
    [FormConfigType.NUMBER]: (props: FieldProps) => {
      return <NumberField {...props} />;
    },
    [FormConfigType.BOOLEAN]: (props: FieldProps) => {
      return <BooleanField {...props} />;
    },
    [FormConfigType.DATE]: (props: FieldProps) => {
      return <DateField {...props} />;
    },
    [FormConfigType.ENUM]: (props: FieldProps) => {
      const { options = [] } = props;
      return <EnumField {...props} options={options} />;
    },
    [FormConfigType.ARRAY]: (props: FieldProps) => {
      const renderField = ({ fieldName, index: _index }: { fieldName: string; index: number }) => {
        return getDefaultFieldMap()[FormConfigType.STRING]({
          ...props,
          name: fieldName,
        });
      };
      return <ArrayField {...props} renderField={renderField} />;
    },
    [FormConfigType.RECORD]: (props: FieldProps) => {
      const renderField = ({ fieldName, index: _index }: { fieldName: string; index: number }) => {
        return getDefaultFieldMap()[FormConfigType.STRING]({
          ...props,
          name: fieldName,
        });
      };
      return <RecordField {...props} renderField={renderField} />;
    },
    [FormConfigType.OBJECT]: (props: FieldProps) => {
      const { innerSchema, name, control, handleFieldChange } = props;
      if (!innerSchema) return null;
      return (
        <ObjectField
          schema={innerSchema}
          control={control}
          parentField={name}
          handleFieldChange={(field, value) => handleFieldChange({ key: field, value })}
          formValues={{}}
          errors={{}}
          renderDynamicForm={props => resolveSchema({ ...props, handleFieldChange })}
        />
      );
    },
    [FormConfigType.UNION]: (props: FieldProps) => {
      const { innerSchema, name, control, handleFieldChange } = props;
      if (!innerSchema || !(innerSchema instanceof z.ZodUnion)) return null;
      return (
        <UnionField
          schema={innerSchema}
          control={control}
          parentField={name}
          handleFieldChange={(field, value) => handleFieldChange({ key: field, value })}
          renderDynamicForm={fieldProps => {
            const fieldType = getFormConfigTypesFromSchemaDef({ schema: fieldProps.schema });
            return getDefaultFieldMap()[fieldType.type]({
              ...props,
              ...fieldProps,
              control,
              handleFieldChange,
            });
          }}
          formValues={{}}
          errors={{}}
        />
      );
    },
    [FormConfigType.CREATABLE]: (props: FieldProps) => {
      return <CreatableField {...props} />;
    },
    [FormConfigType.SELECT]: (props: FieldProps) => {
      const { options = [] } = props;
      return <EnumField {...props} options={options} />;
    },
    [FormConfigType.MULTI_SELECT]: (props: FieldProps) => {
      return <CreatableField {...props} />;
    },
  };
}

export { Root, type JSONSchemaFormRootProps } from './json-schema-form-root';
export { Field, type JSONSchemaFormFieldProps } from './json-schema-form-field';
export { FieldList, type JSONSchemaFormFieldListProps } from './json-schema-form-field-list';
export { FieldName, type JSONSchemaFormFieldNameProps } from './json-schema-form-field-name';
export { FieldType, type JSONSchemaFormFieldTypeProps } from './json-schema-form-field-type';
export {
  FieldDescription,
  type JSONSchemaFormFieldDescriptionProps,
} from './json-schema-form-field-description';
export { FieldOptional, type JSONSchemaFormFieldOptionalProps } from './json-schema-form-field-optional';
export { FieldNullable, type JSONSchemaFormFieldNullableProps } from './json-schema-form-field-nullable';
export { FieldRemove, type JSONSchemaFormFieldRemoveProps } from './json-schema-form-field-remove';
export { NestedFields, type JSONSchemaFormNestedFieldsProps } from './json-schema-form-nested-fields';
export { AddField, type JSONSchemaFormAddFieldProps } from './json-schema-form-add-field';

export { useJSONSchemaForm } from './json-schema-form-context';
export { useJSONSchemaFormField } from './json-schema-form-field-context';
export { useJSONSchemaFormNestedContext } from './json-schema-form-nested-context';

export type { SchemaField, FieldType as SchemaFieldType, JSONSchemaOutput } from './types';
export { createField } from './types';
export { fieldsToJSONSchema } from './utils';

import { Root } from './json-schema-form-root';
import { Field } from './json-schema-form-field';
import { FieldList } from './json-schema-form-field-list';
import { FieldName } from './json-schema-form-field-name';
import { FieldType } from './json-schema-form-field-type';
import { FieldDescription } from './json-schema-form-field-description';
import { FieldOptional } from './json-schema-form-field-optional';
import { FieldNullable } from './json-schema-form-field-nullable';
import { FieldRemove } from './json-schema-form-field-remove';
import { NestedFields } from './json-schema-form-nested-fields';
import { AddField } from './json-schema-form-add-field';

export const JSONSchemaForm = {
  Root,
  Field,
  FieldList,
  FieldName,
  FieldType,
  FieldDescription,
  FieldOptional,
  FieldNullable,
  FieldRemove,
  NestedFields,
  AddField,
};

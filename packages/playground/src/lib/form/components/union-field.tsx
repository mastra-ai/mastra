import type { ParsedField } from '@autoform/core';
import type { AutoFormFieldProps } from '@autoform/react';
import { Txt } from '@mastra/playground-ui';
import { CustomAutoFormField } from './custom-auto-form-field';

export const UnionField: React.FC<AutoFormFieldProps> = ({ field, inputProps }) => {
  const path = inputProps.name?.split('.') ?? [];
  return field.schema?.map((schema: ParsedField, index: number) => {
    return (
      <div key={schema.key}>
        <CustomAutoFormField key={path.join('.')} field={schema} path={path} />
        {index < (field.schema?.length ?? 0) - 1 && (
          <Txt variant="ui-xs" className="text-center">
            OR
          </Txt>
        )}
      </div>
    );
  });
};

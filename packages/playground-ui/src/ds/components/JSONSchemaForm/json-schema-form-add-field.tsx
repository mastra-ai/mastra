import * as React from 'react';
import { useJSONSchemaForm } from './json-schema-form-context';
import { useJSONSchemaFormNestedContext } from './json-schema-form-nested-context';
import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button';

export type JSONSchemaFormAddFieldProps = Omit<ButtonProps, 'onClick'>;

export function AddField({ children, ...props }: JSONSchemaFormAddFieldProps) {
  const { addField } = useJSONSchemaForm();
  const nestedContext = useJSONSchemaFormNestedContext();

  // Use nested context parentPath if available, otherwise add to root
  const parentPath = nestedContext ? nestedContext.parentPath : [];

  const handleClick = React.useCallback(() => {
    addField(parentPath);
  }, [addField, parentPath]);

  return (
    <Button type="button" {...props} onClick={handleClick}>
      {children || 'Add field'}
    </Button>
  );
}

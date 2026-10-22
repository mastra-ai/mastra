import { Plus } from 'lucide-react';
import * as React from 'react';
import { Button } from '../Button';
import type { ButtonProps } from '../Button';
import { useJSONSchemaForm } from './json-schema-form-context';
import { useJSONSchemaFormNestedContext } from './json-schema-form-nested-context';

export type JSONSchemaFormAddFieldProps = Omit<ButtonProps, 'onClick'>;

export function AddField({ children, ...props }: JSONSchemaFormAddFieldProps) {
  const { addField } = useJSONSchemaForm();
  const nestedContext = useJSONSchemaFormNestedContext();

  // Use nested context parentPath if available, otherwise add to root
  const parentPath = nestedContext?.parentPath;

  const handleClick = React.useCallback(() => {
    addField(parentPath ?? []);
  }, [addField, parentPath]);

  return (
    <Button icon={<Plus />} type="button" {...props} onClick={handleClick}>
      {children || 'Add field'}
    </Button>
  );
}

import { JSONSchemaForm, jsonSchemaToFields, ScrollArea } from '@mastra/playground-ui';
import type { JsonSchema, SchemaField } from '@mastra/playground-ui';
import { Plus, PlusIcon } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useWatch } from 'react-hook-form';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';

function RecursiveFieldRenderer({
  field,
  parentPath,
  depth,
}: {
  field: SchemaField;
  parentPath: string[];
  depth: number;
}) {
  return (
    <div className="py-2 ">
      <JSONSchemaForm.Field key={field.id} field={field} parentPath={parentPath} depth={depth}>
        <div className="space-y-2 px-2">
          <div className="flex flex-row gap-4 items-center">
            <JSONSchemaForm.FieldName placeholder="Variable name" className="w-64" />
            <JSONSchemaForm.FieldType placeholder="Type" />
            <JSONSchemaForm.FieldOptional />
            <JSONSchemaForm.FieldNullable />
            <JSONSchemaForm.FieldRemove aria-label="Remove Variable" />
          </div>
        </div>

        <JSONSchemaForm.NestedFields className="pl-2">
          <JSONSchemaForm.FieldList>
            {(nestedField, _idx, nestedContext) => (
              <RecursiveFieldRenderer
                key={nestedField.id}
                field={nestedField}
                parentPath={nestedContext.parentPath}
                depth={nestedContext.depth}
              />
            )}
          </JSONSchemaForm.FieldList>
          <JSONSchemaForm.AddField variant="ghost" size="sm" className="mt-2">
            <PlusIcon className="w-3 h-3 mr-1" />
            Add nested variable
          </JSONSchemaForm.AddField>
        </JSONSchemaForm.NestedFields>
      </JSONSchemaForm.Field>
    </div>
  );
}

export function VariablesPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;

  const watchedVariables = useWatch({ control, name: 'variables' });

  const handleVariablesChange = useCallback(
    (newSchema: JsonSchema) => {
      form.setValue('variables', newSchema, { shouldDirty: true });
    },
    [form],
  );

  const initialFields = useMemo(() => jsonSchemaToFields(watchedVariables), [watchedVariables]);

  return (
    <ScrollArea className="h-full">
      <section className="flex flex-col gap-6">
        <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
          <JSONSchemaForm.Root onChange={handleVariablesChange} defaultValue={initialFields} maxDepth={5}>
            <JSONSchemaForm.FieldList>
              {(field, _index, { parentPath, depth }) => (
                <RecursiveFieldRenderer key={field.id} field={field} parentPath={parentPath} depth={depth} />
              )}
            </JSONSchemaForm.FieldList>

            <div className="p-2">
              <JSONSchemaForm.AddField>
                <Plus />
                Add variable
              </JSONSchemaForm.AddField>
            </div>
          </JSONSchemaForm.Root>
        </div>
      </section>
    </ScrollArea>
  );
}

import { useCallback, useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import { PlusIcon } from 'lucide-react';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { SectionHeader } from '@/domains/cms';
import { JSONSchemaForm, type SchemaField, jsonSchemaToFields } from '@/ds/components/JSONSchemaForm';
import type { JsonSchema } from '@/lib/json-schema';

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
    <div className="py-2 border-border1 border-l-4 border-b">
      <JSONSchemaForm.Field key={field.id} field={field} parentPath={parentPath} depth={depth}>
        <div className="space-y-2 px-2">
          <div className="flex flex-row gap-2 items-center">
            <JSONSchemaForm.FieldName
              labelIsHidden
              placeholder="Variable name"
              size="md"
              className="[&_input]:bg-surface3 w-full"
            />

            <JSONSchemaForm.FieldType placeholder="Type" size="md" className="[&_button]:bg-surface3 w-full" />
            <JSONSchemaForm.FieldRemove variant="light" size="md" className="shrink-0" />
          </div>

          <div className="flex flex-row gap-2 items-center">
            <JSONSchemaForm.FieldOptional />
            <JSONSchemaForm.FieldNullable />
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
      <div className="flex flex-col gap-8 p-4">
        <section className="flex flex-col gap-6">
          <div className="border-b border-border1 pb-4">
            <SectionHeader
              title="Variables"
              subtitle={
                <>
                  Variables are dynamic values that change based on the context of each request. Use them in your
                  agent's instructions with the <code className="text-[#F59E0B] font-medium">{'{{variableName}}'}</code>{' '}
                  syntax.
                </>
              }
            />
          </div>

          <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
            <JSONSchemaForm.Root onChange={handleVariablesChange} defaultValue={initialFields} maxDepth={5}>
              <JSONSchemaForm.FieldList>
                {(field, _index, { parentPath, depth }) => (
                  <RecursiveFieldRenderer key={field.id} field={field} parentPath={parentPath} depth={depth} />
                )}
              </JSONSchemaForm.FieldList>

              <div className="p-2">
                <JSONSchemaForm.AddField variant="outline" size="sm">
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Add variable
                </JSONSchemaForm.AddField>
              </div>
            </JSONSchemaForm.Root>
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}

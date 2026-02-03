import { useState, useMemo } from 'react';
import { PlusIcon } from 'lucide-react';

import { SideDialog } from '@/ds/components/SideDialog';
import { Button } from '@/ds/components/Button';
import { JSONSchemaForm, type SchemaField, jsonSchemaToFields } from '@/ds/components/JSONSchemaForm';
import { VariablesIcon } from '@/ds/icons';
import type { JsonSchema } from '@/lib/json-schema';

export interface VariableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultValue?: JsonSchema;
  onSave: (schema: JsonSchema) => void;
}

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
    <JSONSchemaForm.Field key={field.id} field={field} parentPath={parentPath} depth={depth}>
      <div className="flex gap-2 items-center mb-2">
        <JSONSchemaForm.FieldName
          label="Name"
          labelIsHidden
          placeholder="Variable name"
          size="md"
          className="flex-1 [&_input]:bg-surface3"
        />
        <JSONSchemaForm.FieldType label="Type" placeholder="Type" size="md" className="w-32 [&_button]:bg-surface3" />
        <JSONSchemaForm.FieldOptional className="shrink-0" />
        <JSONSchemaForm.FieldNullable className="shrink-0" />
        <JSONSchemaForm.FieldRemove variant="ghost" size="md" />
      </div>
      <JSONSchemaForm.FieldDescription
        label="Description"
        labelIsHidden
        placeholder="Description (optional)"
        size="md"
        className="mb-2 [&_input]:bg-surface3"
      />
      <JSONSchemaForm.NestedFields className="ml-4">
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
  );
}

export function VariableDialog({ isOpen, onClose, defaultValue, onSave }: VariableDialogProps) {
  const [currentSchema, setCurrentSchema] = useState<JsonSchema | null>(null);

  const initialFields = useMemo(() => jsonSchemaToFields(defaultValue), [defaultValue]);

  const handleSave = () => {
    if (currentSchema) {
      onSave(currentSchema);
    }
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <SideDialog
      isOpen={isOpen}
      onClose={handleCancel}
      dialogTitle="Variables"
      dialogDescription="Define agent variables"
      level={2}
    >
      <SideDialog.Top className="items-center">
        <SideDialog.Header className="flex-1 pb-0">
          <SideDialog.Heading className="items-center">
            <VariablesIcon />
            Variables
          </SideDialog.Heading>
        </SideDialog.Header>
      </SideDialog.Top>
      <SideDialog.Content className="flex flex-col">
        <div className="flex-1">
          <JSONSchemaForm.Root onChange={setCurrentSchema} defaultValue={initialFields} maxDepth={5}>
            <JSONSchemaForm.FieldList>
              {(field, _index, { parentPath, depth }) => (
                <RecursiveFieldRenderer key={field.id} field={field} parentPath={parentPath} depth={depth} />
              )}
            </JSONSchemaForm.FieldList>
            <JSONSchemaForm.AddField variant="ghost" size="md" className="mt-4">
              <PlusIcon className="w-4 h-4 mr-2" />
              Add variable
            </JSONSchemaForm.AddField>
          </JSONSchemaForm.Root>
        </div>
        <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-border1">
          <Button variant="outline" onClick={handleCancel} type="button">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} type="button">
            Save variables
          </Button>
        </div>
      </SideDialog.Content>
    </SideDialog>
  );
}

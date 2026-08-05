import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { TooltipProvider } from '../Tooltip';
import type { SchemaField } from './types';
import { createField } from './types';
import { JSONSchemaForm } from './index';
import type { JsonSchema } from '@/lib/json-schema';

const meta: Meta<typeof JSONSchemaForm.Root> = {
  title: 'Forms/JSONSchemaForm',
  component: JSONSchemaForm.Root,
  decorators: [
    Story => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof JSONSchemaForm.Root>;

function JSONSchemaPreview({ schema }: { schema: JsonSchema | null }) {
  if (!schema) return null;
  return (
    <pre className="bg-surface2 text-neutral4 mt-4 max-h-64 overflow-auto rounded-md p-4 text-xs">
      {JSON.stringify(schema, null, 2)}
    </pre>
  );
}

// Recursive field renderer component for arbitrary nesting depth
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
      <div className="mb-2 flex items-start gap-2">
        <JSONSchemaForm.FieldName label="Name" placeholder="Property name" />
        <JSONSchemaForm.FieldType label="Type" placeholder="Type" />
        <JSONSchemaForm.FieldRemove />
      </div>
      <JSONSchemaForm.FieldDescription
        label="Description"
        labelIsHidden
        placeholder="Description (optional)"
        className="mb-2"
      />
      <div className="mb-2 flex gap-4">
        <JSONSchemaForm.FieldOptional />
        <JSONSchemaForm.FieldNullable />
      </div>
      <JSONSchemaForm.NestedFields className="m-4 mr-0">
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
        <JSONSchemaForm.AddField className="mt-2">
          <PlusIcon />
          Add nested property
        </JSONSchemaForm.AddField>
      </JSONSchemaForm.NestedFields>
    </JSONSchemaForm.Field>
  );
}

export const Default: Story = {
  render: () => {
    const [schema, setSchema] = useState<JsonSchema | null>(null);

    return (
      <div className="w-125">
        <JSONSchemaForm.Root onChange={setSchema}>
          <JSONSchemaForm.FieldList>
            {(field, _index, { parentPath, depth }) => (
              <RecursiveFieldRenderer key={field.id} field={field} parentPath={parentPath} depth={depth} />
            )}
          </JSONSchemaForm.FieldList>
          <JSONSchemaForm.AddField className="mt-4">
            <PlusIcon className="mr-2 size-4" />
            Add property
          </JSONSchemaForm.AddField>
        </JSONSchemaForm.Root>
        <JSONSchemaPreview schema={schema} />
      </div>
    );
  },
};

export const WithDefaultValues: Story = {
  render: () => {
    const [schema, setSchema] = useState<JsonSchema | null>(null);

    const defaultFields: SchemaField[] = [
      createField({ name: 'name', type: 'string', description: 'User name' }),
      createField({ name: 'age', type: 'number', optional: true }),
      createField({ name: 'email', type: 'string', nullable: true }),
    ];

    return (
      <div className="w-125">
        <JSONSchemaForm.Root onChange={setSchema} defaultValue={defaultFields}>
          <JSONSchemaForm.FieldList>
            {(field, _index, { parentPath, depth }) => (
              <JSONSchemaForm.Field key={field.id} field={field} parentPath={parentPath} depth={depth}>
                <div className="mb-2 flex items-start gap-2">
                  <JSONSchemaForm.FieldName label="Name" labelIsHidden placeholder="Property name" className="flex-1" />
                  <JSONSchemaForm.FieldType label="Type" placeholder="Type" />
                  <JSONSchemaForm.FieldRemove />
                </div>
                <JSONSchemaForm.FieldDescription
                  label="Description"
                  labelIsHidden
                  placeholder="Description (optional)"
                  className="mb-2"
                />
                <div className="mb-4 flex gap-4">
                  <JSONSchemaForm.FieldOptional />
                  <JSONSchemaForm.FieldNullable />
                </div>
              </JSONSchemaForm.Field>
            )}
          </JSONSchemaForm.FieldList>
          <JSONSchemaForm.AddField className="mt-4">
            <PlusIcon />
            Add property
          </JSONSchemaForm.AddField>
        </JSONSchemaForm.Root>
        <JSONSchemaPreview schema={schema} />
      </div>
    );
  },
};

export const CompactLayout: Story = {
  render: () => {
    const [schema, setSchema] = useState<JsonSchema | null>(null);

    return (
      <div className="w-100">
        <JSONSchemaForm.Root onChange={setSchema}>
          <JSONSchemaForm.FieldList>
            {(field, _index, { parentPath, depth }) => (
              <JSONSchemaForm.Field
                key={field.id}
                field={field}
                parentPath={parentPath}
                depth={depth}
                className="mb-2 flex items-center gap-2"
              >
                <JSONSchemaForm.FieldName label="Name" labelIsHidden placeholder="Name" className="flex-1" />
                <JSONSchemaForm.FieldType label="Type" placeholder="Type" className="w-24" />
                <JSONSchemaForm.FieldOptional label="" className="shrink-0" />
                <JSONSchemaForm.FieldRemove />
              </JSONSchemaForm.Field>
            )}
          </JSONSchemaForm.FieldList>
          <JSONSchemaForm.AddField className="mt-2 w-full" size="md">
            Add field
          </JSONSchemaForm.AddField>
        </JSONSchemaForm.Root>
        <JSONSchemaPreview schema={schema} />
      </div>
    );
  },
};

export const NestedObjects: Story = {
  render: () => {
    const [schema, setSchema] = useState<JsonSchema | null>(null);

    const defaultFields: SchemaField[] = [
      createField({
        name: 'user',
        type: 'object',
        properties: [
          createField({ name: 'firstName', type: 'string' }),
          createField({ name: 'lastName', type: 'string' }),
        ],
      }),
      createField({
        name: 'tags',
        type: 'array',
      }),
    ];

    return (
      <div className="w-150">
        <JSONSchemaForm.Root onChange={setSchema} defaultValue={defaultFields} maxDepth={5}>
          <JSONSchemaForm.FieldList>
            {(field, _index, { parentPath, depth }) => (
              <RecursiveFieldRenderer key={field.id} field={field} parentPath={parentPath} depth={depth} />
            )}
          </JSONSchemaForm.FieldList>
          <JSONSchemaForm.AddField className="mt-4">
            <PlusIcon />
            Add property
          </JSONSchemaForm.AddField>
        </JSONSchemaForm.Root>
        <JSONSchemaPreview schema={schema} />
      </div>
    );
  },
};

export const CustomStyling: Story = {
  render: () => {
    const [schema, setSchema] = useState<JsonSchema | null>(null);

    return (
      <div className="w-125">
        <JSONSchemaForm.Root onChange={setSchema} className="space-y-4">
          <JSONSchemaForm.FieldList className="space-y-4">
            {(field, _index, { parentPath, depth }) => (
              <JSONSchemaForm.Field
                key={field.id}
                field={field}
                parentPath={parentPath}
                depth={depth}
                className="border-border1 bg-surface1 rounded-lg border p-4"
              >
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <JSONSchemaForm.FieldName label="Property Name" placeholder="Enter name" />
                  <JSONSchemaForm.FieldType label="Data Type" placeholder="Select type" />
                </div>
                <JSONSchemaForm.FieldDescription
                  label="Description"
                  placeholder="Describe this field..."
                  className="mb-3"
                />
                <div className="flex items-center justify-between">
                  <div className="flex gap-6">
                    <JSONSchemaForm.FieldOptional label="Optional field" labelClassName="text-neutral4" />
                    <JSONSchemaForm.FieldNullable label="Allow null" labelClassName="text-neutral4" />
                  </div>
                  <JSONSchemaForm.FieldRemove variant="outline" tooltip="Remove this field" />
                </div>
              </JSONSchemaForm.Field>
            )}
          </JSONSchemaForm.FieldList>
          <JSONSchemaForm.AddField variant="primary" size="lg" className="w-full">
            <PlusIcon className="mr-2 size-4" />
            Add New Property
          </JSONSchemaForm.AddField>
        </JSONSchemaForm.Root>
        <JSONSchemaPreview schema={schema} />
      </div>
    );
  },
};

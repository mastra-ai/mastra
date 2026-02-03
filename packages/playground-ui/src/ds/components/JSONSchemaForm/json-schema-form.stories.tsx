import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { TooltipProvider } from '../Tooltip';
import { JSONSchemaForm } from './index';
import type { JSONSchemaOutput, SchemaField } from './types';
import { createField } from './types';

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
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof JSONSchemaForm.Root>;

function JSONSchemaPreview({ schema }: { schema: JSONSchemaOutput | null }) {
  if (!schema) return null;
  return (
    <pre className="mt-4 p-4 bg-surface2 rounded-md text-xs text-neutral4 overflow-auto max-h-64">
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
      <div className="flex gap-2 items-start mb-2">
        <JSONSchemaForm.FieldName
          label="Name"
          labelIsHidden
          placeholder="Property name"
          size="md"
          className="flex-1"
        />
        <JSONSchemaForm.FieldType label="Type" placeholder="Type" size="md" className="w-32" />
        <JSONSchemaForm.FieldRemove variant="ghost" size="md" />
      </div>
      <JSONSchemaForm.FieldDescription
        label="Description"
        labelIsHidden
        placeholder="Description (optional)"
        size="md"
        className="mb-2"
      />
      <div className="flex gap-4 mb-2">
        <JSONSchemaForm.FieldOptional />
        <JSONSchemaForm.FieldNullable />
      </div>
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
          Add nested property
        </JSONSchemaForm.AddField>
      </JSONSchemaForm.NestedFields>
    </JSONSchemaForm.Field>
  );
}

export const Default: Story = {
  render: () => {
    const [schema, setSchema] = useState<JSONSchemaOutput | null>(null);

    return (
      <div className="w-[500px]">
        <JSONSchemaForm.Root onChange={setSchema}>
          <JSONSchemaForm.FieldList>
            {(field, _index, { parentPath, depth }) => (
              <RecursiveFieldRenderer
                key={field.id}
                field={field}
                parentPath={parentPath}
                depth={depth}
              />
            )}
          </JSONSchemaForm.FieldList>
          <JSONSchemaForm.AddField variant="ghost" size="md" className="mt-4">
            <PlusIcon className="w-4 h-4 mr-2" />
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
    const [schema, setSchema] = useState<JSONSchemaOutput | null>(null);

    const defaultFields: SchemaField[] = [
      createField({ name: 'name', type: 'string', description: 'User name' }),
      createField({ name: 'age', type: 'number', optional: true }),
      createField({ name: 'email', type: 'string', nullable: true }),
    ];

    return (
      <div className="w-[500px]">
        <JSONSchemaForm.Root onChange={setSchema} defaultValue={defaultFields}>
          <JSONSchemaForm.FieldList>
            {(field, _index, { parentPath, depth }) => (
              <JSONSchemaForm.Field key={field.id} field={field} parentPath={parentPath} depth={depth}>
                <div className="flex gap-2 items-start mb-2">
                  <JSONSchemaForm.FieldName
                    label="Name"
                    labelIsHidden
                    placeholder="Property name"
                    size="md"
                    className="flex-1"
                  />
                  <JSONSchemaForm.FieldType
                    label="Type"
                    placeholder="Type"
                    size="md"
                    className="w-32"
                  />
                  <JSONSchemaForm.FieldRemove variant="ghost" size="md" />
                </div>
                <JSONSchemaForm.FieldDescription
                  label="Description"
                  labelIsHidden
                  placeholder="Description (optional)"
                  size="md"
                  className="mb-2"
                />
                <div className="flex gap-4 mb-4">
                  <JSONSchemaForm.FieldOptional />
                  <JSONSchemaForm.FieldNullable />
                </div>
              </JSONSchemaForm.Field>
            )}
          </JSONSchemaForm.FieldList>
          <JSONSchemaForm.AddField variant="ghost" size="md" className="mt-4">
            <PlusIcon className="w-4 h-4 mr-2" />
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
    const [schema, setSchema] = useState<JSONSchemaOutput | null>(null);

    return (
      <div className="w-[400px]">
        <JSONSchemaForm.Root onChange={setSchema}>
          <JSONSchemaForm.FieldList>
            {(field, _index, { parentPath, depth }) => (
              <JSONSchemaForm.Field key={field.id} field={field} parentPath={parentPath} depth={depth} className="flex gap-2 items-center mb-2">
                <JSONSchemaForm.FieldName
                  label="Name"
                  labelIsHidden
                  placeholder="Name"
                  size="sm"
                  className="flex-1"
                />
                <JSONSchemaForm.FieldType
                  label="Type"
                  placeholder="Type"
                  size="sm"
                  className="w-24"
                />
                <JSONSchemaForm.FieldOptional label="" className="shrink-0" />
                <JSONSchemaForm.FieldRemove variant="ghost" size="sm" />
              </JSONSchemaForm.Field>
            )}
          </JSONSchemaForm.FieldList>
          <JSONSchemaForm.AddField variant="outline" size="sm" className="mt-2 w-full">
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
    const [schema, setSchema] = useState<JSONSchemaOutput | null>(null);

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
      <div className="w-[600px]">
        <JSONSchemaForm.Root onChange={setSchema} defaultValue={defaultFields} maxDepth={5}>
          <JSONSchemaForm.FieldList>
            {(field, _index, { parentPath, depth }) => (
              <RecursiveFieldRenderer
                key={field.id}
                field={field}
                parentPath={parentPath}
                depth={depth}
              />
            )}
          </JSONSchemaForm.FieldList>
          <JSONSchemaForm.AddField variant="ghost" size="md" className="mt-4">
            <PlusIcon className="w-4 h-4 mr-2" />
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
    const [schema, setSchema] = useState<JSONSchemaOutput | null>(null);

    return (
      <div className="w-[500px]">
        <JSONSchemaForm.Root onChange={setSchema} className="space-y-4">
          <JSONSchemaForm.FieldList className="space-y-4">
            {(field, _index, { parentPath, depth }) => (
              <JSONSchemaForm.Field
                key={field.id}
                field={field}
                parentPath={parentPath}
                depth={depth}
                className="p-4 border border-border1 rounded-lg bg-surface1"
              >
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <JSONSchemaForm.FieldName
                    label="Property Name"
                    placeholder="Enter name"
                    size="lg"
                  />
                  <JSONSchemaForm.FieldType
                    label="Data Type"
                    placeholder="Select type"
                    size="lg"
                  />
                </div>
                <JSONSchemaForm.FieldDescription
                  label="Description"
                  placeholder="Describe this field..."
                  size="lg"
                  className="mb-3"
                />
                <div className="flex justify-between items-center">
                  <div className="flex gap-6">
                    <JSONSchemaForm.FieldOptional
                      label="Optional field"
                      labelClassName="text-neutral4"
                    />
                    <JSONSchemaForm.FieldNullable
                      label="Allow null"
                      labelClassName="text-neutral4"
                    />
                  </div>
                  <JSONSchemaForm.FieldRemove
                    variant="outline"
                    size="md"
                    tooltip="Remove this field"
                  />
                </div>
              </JSONSchemaForm.Field>
            )}
          </JSONSchemaForm.FieldList>
          <JSONSchemaForm.AddField variant="primary" size="lg" className="w-full">
            <PlusIcon className="w-4 h-4 mr-2" />
            Add New Property
          </JSONSchemaForm.AddField>
        </JSONSchemaForm.Root>
        <JSONSchemaPreview schema={schema} />
      </div>
    );
  },
};

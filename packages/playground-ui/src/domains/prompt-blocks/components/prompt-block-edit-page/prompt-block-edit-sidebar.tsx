import { useCallback, useMemo } from 'react';
import { type UseFormReturn, useWatch } from 'react-hook-form';
import { Check, Plus, PlusIcon, Save } from 'lucide-react';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { Spinner } from '@/ds/components/Spinner';
import { Input } from '@/ds/components/Input';
import { Textarea } from '@/ds/components/Textarea';
import { Label } from '@/ds/components/Label';
import { SectionHeader } from '@/domains/cms';
import { JSONSchemaForm, type SchemaField, jsonSchemaToFields } from '@/ds/components/JSONSchemaForm';
import type { JsonSchema } from '@/lib/json-schema';

import type { PromptBlockFormValues } from './utils/form-validation';

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
          <div className="flex flex-row gap-4 items-center">
            <JSONSchemaForm.FieldName
              labelIsHidden
              placeholder="Variable name"
              size="md"
              className="[&_input]:bg-surface3 w-full"
            />

            <JSONSchemaForm.FieldType placeholder="Type" size="md" className="[&_button]:bg-surface3 w-full" />
            <JSONSchemaForm.FieldOptional />
            <JSONSchemaForm.FieldNullable />
            <JSONSchemaForm.FieldRemove variant="outline" size="md" className="shrink-0" />
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

interface PromptBlockEditSidebarProps {
  form: UseFormReturn<PromptBlockFormValues>;
  onPublish: () => void;
  onSaveDraft?: () => void;
  isSubmitting?: boolean;
  isSavingDraft?: boolean;
  isDirty?: boolean;
  hasDraft?: boolean;
  mode?: 'create' | 'edit';
  /** Key that changes when form is reset with new data, forces JSONSchemaForm to remount */
  formResetKey?: number;
}

export function PromptBlockEditSidebar({
  form,
  onPublish,
  onSaveDraft,
  isSubmitting = false,
  isSavingDraft = false,
  isDirty = false,
  hasDraft = false,
  mode = 'create',
  formResetKey = 0,
}: PromptBlockEditSidebarProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  const watchedVariables = useWatch({ control, name: 'variables' });

  const handleVariablesChange = useCallback(
    (newSchema: JsonSchema) => {
      form.setValue('variables', newSchema, { shouldDirty: true });
    },
    [form],
  );

  const initialFields = useMemo(() => jsonSchemaToFields(watchedVariables), [watchedVariables]);

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-6 p-4">
          <SectionHeader title="Configuration" subtitle="Define your prompt block's name and description." />

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prompt-block-name" className="text-xs text-neutral5">
              Name <span className="text-accent2">*</span>
            </Label>
            <Input
              id="prompt-block-name"
              placeholder="My Prompt Block"
              className="bg-surface3"
              {...register('name')}
              error={!!errors.name}
            />
            {errors.name && <span className="text-xs text-accent2">{errors.name.message}</span>}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prompt-block-description" className="text-xs text-neutral5">
              Description
            </Label>
            <Textarea
              id="prompt-block-description"
              placeholder="Describe what this prompt block does"
              className="bg-surface3"
              {...register('description')}
              error={!!errors.description}
            />
            {errors.description && <span className="text-xs text-accent2">{errors.description.message}</span>}
          </div>
        </div>

        {/* Variables */}
        <div className="flex flex-col gap-4 p-4 border-t border-border1">
          <SectionHeader
            title="Variables"
            subtitle={
              <>
                Define variables for this prompt block. Use{' '}
                <code className="text-accent1 font-medium">{'{{variableName}}'}</code> syntax in your content.
              </>
            }
          />

          <JSONSchemaForm.Root
            key={formResetKey}
            onChange={handleVariablesChange}
            defaultValue={initialFields}
            maxDepth={5}
          >
            <JSONSchemaForm.FieldList>
              {(field, _index, { parentPath, depth }) => (
                <RecursiveFieldRenderer key={field.id} field={field} parentPath={parentPath} depth={depth} />
              )}
            </JSONSchemaForm.FieldList>

            <div className="p-2">
              <JSONSchemaForm.AddField className="bg-transparent flex items-center justify-center gap-2 text-ui-sm text-neutral3 hover:text-neutral6 w-full border border-dashed border-border1 p-2 rounded-md">
                <Icon>
                  <Plus />
                </Icon>
                Add variable
              </JSONSchemaForm.AddField>
            </div>
          </JSONSchemaForm.Root>
        </div>
      </ScrollArea>

      {/* Sticky footer */}
      <div className="flex-shrink-0 p-4">
        {mode === 'edit' && onSaveDraft ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onSaveDraft}
              disabled={!isDirty || isSavingDraft || isSubmitting}
              className="flex-1"
            >
              {isSavingDraft ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Saving...
                </>
              ) : (
                <>
                  <Icon>
                    <Save />
                  </Icon>
                  Save
                </>
              )}
            </Button>
            <Button
              variant="primary"
              onClick={onPublish}
              disabled={(!hasDraft && !isDirty) || isSubmitting || isSavingDraft}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Publishing...
                </>
              ) : (
                <>
                  <Icon>
                    <Check />
                  </Icon>
                  Publish
                </>
              )}
            </Button>
          </div>
        ) : (
          <Button variant="primary" onClick={onPublish} disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Spinner className="h-4 w-4" />
                Creating...
              </>
            ) : (
              <>
                <Icon>
                  <Check />
                </Icon>
                Create prompt block
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

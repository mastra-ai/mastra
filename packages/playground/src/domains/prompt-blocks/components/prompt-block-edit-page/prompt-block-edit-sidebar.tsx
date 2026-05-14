import {
  Button,
  Input,
  JSONSchemaForm,
  jsonSchemaToFields,
  Label,
  ScrollArea,
  Spinner,
  Textarea,
  Txt,
} from '@mastra/playground-ui';
import type { JsonSchema, SchemaField } from '@mastra/playground-ui';
import { Check, Plus, PlusIcon, Save } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';

import type { PromptBlockFormValues } from './utils/form-validation';
import { useStoredAgents } from '@/domains/agents/hooks/use-stored-agents';
import { SectionHeader } from '@/domains/cms';
import { useLinkComponent } from '@/lib/framework';

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
    <div className={'py-2'} style={{ paddingLeft: depth * 8 }}>
      <JSONSchemaForm.Field key={field.id} field={field} parentPath={parentPath} depth={depth}>
        <div className="space-y-2 px-2">
          <div className="flex flex-row gap-4 items-center">
            <JSONSchemaForm.FieldName
              labelIsHidden
              placeholder="Variable name"
              size="md"
              className="[&_input]:bg-surface3 w-full"
            />

            <JSONSchemaForm.FieldType placeholder="Type" />
            <JSONSchemaForm.FieldOptional />
            <JSONSchemaForm.FieldNullable />
            <JSONSchemaForm.FieldRemove variant="outline" />
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
          <JSONSchemaForm.AddField className="mt-2" size="sm">
            <PlusIcon />
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
  /** Block ID, used to show "Used by" agents section in edit mode */
  blockId?: string;
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
  blockId,
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

  const { data: storedAgentsData } = useStoredAgents();
  const { navigate, paths } = useLinkComponent();

  const usedByAgents = useMemo(() => {
    if (!blockId || !storedAgentsData?.agents) return [];
    return storedAgentsData.agents.filter(agent => {
      if (!Array.isArray(agent.instructions)) return false;
      return agent.instructions.some(instr => instr.type === 'prompt_block_ref' && instr.id === blockId);
    });
  }, [blockId, storedAgentsData]);

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
              <JSONSchemaForm.AddField>
                <Plus />
                Add variable
              </JSONSchemaForm.AddField>
            </div>
          </JSONSchemaForm.Root>
        </div>

        {/* Used by */}
        {mode === 'edit' && blockId && (
          <div className="flex flex-col gap-3 p-4 border-t border-border1">
            <SectionHeader title="Used by" subtitle="Agents that reference this prompt block." />
            {usedByAgents.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {usedByAgents.map(agent => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => navigate(paths.agentLink(agent.id))}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-surface3 transition-colors"
                  >
                    <Txt variant="ui-sm" className="text-neutral5 truncate">
                      {agent.name || agent.id}
                    </Txt>
                  </button>
                ))}
              </div>
            ) : (
              <Txt variant="ui-sm" className="text-neutral3">
                Not referenced by any agents yet.
              </Txt>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Sticky footer */}
      <div className="shrink-0 p-4">
        {mode === 'edit' && onSaveDraft ? (
          <div className="flex gap-2">
            <Button onClick={onSaveDraft} disabled={!isDirty || isSavingDraft || isSubmitting} className="flex-1">
              {isSavingDraft ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Saving...
                </>
              ) : (
                <>
                  <Save />
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
                  <Check />
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
                <Check />
                Create prompt block
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { JSONSchemaForm, jsonSchemaToFields } from '@mastra/playground-ui/components/JSONSchemaForm';
import type { SchemaField } from '@mastra/playground-ui/components/JSONSchemaForm';
import { Label } from '@mastra/playground-ui/components/Label';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Tabs, TabList, Tab, TabContent } from '@mastra/playground-ui/components/Tabs';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { VariablesIcon } from '@mastra/playground-ui/icons/VariablesIcon';
import type { JsonSchema } from '@mastra/playground-ui/utils/json-schema';
import { Check, PlusIcon } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import type { RefObject } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';

import { ToolsSection, WorkflowsSection, AgentsSection, ScorersSection, MemorySection } from './sections';
import type { AgentFormValues } from './utils/form-validation';
import { SectionHeader } from '@/domains/cms';
import { LLMProviders, LLMModels } from '@/domains/llm';

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
    <div className="border-border1 border-b border-l-4 py-2">
      <JSONSchemaForm.Field key={field.id} field={field} parentPath={parentPath} depth={depth}>
        <div className="space-y-2 px-2">
          <div className="flex flex-row items-center gap-2">
            <JSONSchemaForm.FieldName
              labelIsHidden
              placeholder="Variable name"
              size="md"
              className="[&_input]:bg-surface3 w-full"
            />

            <JSONSchemaForm.FieldType placeholder="Type" size="md" className="[&_button]:bg-surface3 w-full" />
            <JSONSchemaForm.FieldRemove variant="default" className="shrink-0" />
          </div>

          <div className="flex flex-row items-center gap-2">
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
            <PlusIcon className="mr-1 h-3 w-3" />
            Add nested variable
          </JSONSchemaForm.AddField>
        </JSONSchemaForm.NestedFields>
      </JSONSchemaForm.Field>
    </div>
  );
}

interface AgentEditSidebarProps {
  form: UseFormReturn<AgentFormValues>;
  currentAgentId?: string;
  onPublish: () => void;
  isSubmitting?: boolean;
  formRef?: RefObject<HTMLFormElement | null>;
  mode?: 'create' | 'edit';
  readOnly?: boolean;
}

export function AgentEditSidebar({
  form,
  currentAgentId,
  onPublish,
  isSubmitting = false,
  formRef,
  mode = 'create',
  readOnly = false,
}: AgentEditSidebarProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  const watchedVariables = useWatch({ control, name: 'variables' });

  const handleVariablesChange = useCallback(
    (schema: JsonSchema) => {
      form.setValue('variables', schema, { shouldDirty: true });
    },
    [form],
  );

  const initialFields = useMemo(() => jsonSchemaToFields(watchedVariables), [watchedVariables]);

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultTab="identity" className="flex min-h-0 flex-1 flex-col">
        <TabList className="shrink-0">
          <Tab value="identity">
            <Icon size="sm">
              <AgentIcon />
            </Icon>
            Identity
          </Tab>
          <Tab value="capabilities">
            <Icon size="sm">
              <ToolsIcon />
            </Icon>
            Capabilities
          </Tab>

          <Tab value="variables">
            <Icon size="sm">
              <VariablesIcon />
            </Icon>
            Variables
          </Tab>
        </TabList>

        <TabContent value="identity" className="min-h-0 flex-1 py-0 pb-3">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-6 p-4">
              <SectionHeader title="Identity" subtitle="Define your agent's name, description, and model." />

              {/* Agent Name */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-name" className="text-icon5 text-xs">
                  Name <span className="text-accent2">*</span>
                </Label>
                <Input
                  id="agent-name"
                  placeholder="My Agent"
                  className="bg-surface3"
                  {...register('name')}
                  error={!!errors.name}
                  disabled={readOnly}
                />
                {errors.name && <span className="text-accent2 text-xs">{errors.name.message}</span>}
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-description" className="text-icon5 text-xs">
                  Description
                </Label>
                <Textarea
                  id="agent-description"
                  placeholder="Describe what this agent does"
                  className="bg-surface3"
                  {...register('description')}
                  error={!!errors.description}
                  disabled={readOnly}
                />
                {errors.description && <span className="text-accent2 text-xs">{errors.description.message}</span>}
              </div>

              {/* Provider */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-icon5 text-xs">
                  Provider <span className="text-accent2">*</span>
                </Label>
                <Controller
                  name="model.provider"
                  control={control}
                  render={({ field }) => (
                    <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                      <LLMProviders value={field.value} onValueChange={field.onChange} container={formRef} />
                    </div>
                  )}
                />
                {errors.model?.provider && (
                  <span className="text-accent2 text-xs">{errors.model.provider.message}</span>
                )}
              </div>

              {/* Model */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-icon5 text-xs">
                  Model <span className="text-accent2">*</span>
                </Label>
                <Controller
                  name="model.name"
                  control={control}
                  render={({ field }) => (
                    <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                      <LLMModels
                        value={field.value}
                        onValueChange={field.onChange}
                        llmId={form.watch('model.provider') || ''}
                        container={formRef}
                      />
                    </div>
                  )}
                />
                {errors.model?.name && <span className="text-accent2 text-xs">{errors.model.name.message}</span>}
              </div>
            </div>
          </ScrollArea>
        </TabContent>

        <TabContent value="capabilities" className="min-h-0 flex-1 py-0 pb-3">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-6 p-4">
              <SectionHeader
                title="Capabilities"
                subtitle="Extend your agent with tools, workflows, and other resources to enhance its abilities."
              />

              <ToolsSection control={control} error={errors.tools?.root?.message} readOnly={readOnly} />
              <WorkflowsSection control={control} error={errors.workflows?.root?.message} readOnly={readOnly} />
              <AgentsSection
                control={control}
                error={errors.agents?.root?.message}
                currentAgentId={currentAgentId}
                readOnly={readOnly}
              />
              <ScorersSection control={control} readOnly={readOnly} />
              <MemorySection control={control} setValue={form.setValue} readOnly={readOnly} />
            </div>
          </ScrollArea>
        </TabContent>

        <TabContent value="variables" className="min-h-0 flex-1 py-0 pb-3">
          <ScrollArea className="h-full">
            <div className="border-border1 flex flex-col gap-6 border-b p-4">
              <SectionHeader
                title="Variables"
                subtitle={
                  <>
                    Variables are dynamic values that change based on the context of each request. Use them in your
                    agent's instructions with the{' '}
                    <code className="font-medium text-[#F59E0B]">{'{{variableName}}'}</code> syntax.
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
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Add variable
                  </JSONSchemaForm.AddField>
                </div>
              </JSONSchemaForm.Root>
            </div>
          </ScrollArea>
        </TabContent>
      </Tabs>

      {/* Sticky footer with Create/Update Agent button */}
      {!readOnly && (
        <div className="shrink-0 p-4">
          <Button variant="primary" onClick={onPublish} disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Spinner className="h-4 w-4" />
                {mode === 'edit' ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <Icon>
                  <Check />
                </Icon>
                {mode === 'edit' ? 'Update agent' : 'Create agent'}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

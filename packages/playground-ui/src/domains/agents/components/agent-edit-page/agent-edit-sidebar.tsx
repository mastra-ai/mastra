import { useCallback, useMemo, type RefObject } from 'react';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import { Check, PlusIcon } from 'lucide-react';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { Tabs, TabList, Tab, TabContent } from '@/ds/components/Tabs';
import { Button } from '@/ds/components/Button';
import { Icon, AgentIcon, ToolsIcon, VariablesIcon } from '@/ds/icons';
import { Spinner } from '@/ds/components/Spinner';
import { Input } from '@/ds/components/Input';
import { Textarea } from '@/ds/components/Textarea';
import { Label } from '@/ds/components/Label';
import { SectionHeader } from '@/domains/cms';
import { JSONSchemaForm, type SchemaField, jsonSchemaToFields } from '@/ds/components/JSONSchemaForm';
import type { JsonSchema } from '@/lib/json-schema';

import { LLMProviders, LLMModels } from '@/domains/llm';

import type { AgentFormValues } from './utils/form-validation';
import { ToolsSection, WorkflowsSection, AgentsSection, ScorersSection, MemorySection } from './sections';

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

interface AgentEditSidebarProps {
  form: UseFormReturn<AgentFormValues>;
  currentAgentId?: string;
  onPublish: () => void;
  isSubmitting?: boolean;
  formRef?: RefObject<HTMLFormElement | null>;
  mode?: 'create' | 'edit';
  readOnly?: boolean;
  hideSubAgentCreate?: boolean;
}

export function AgentEditSidebar({
  form,
  currentAgentId,
  onPublish,
  isSubmitting = false,
  formRef,
  mode = 'create',
  readOnly = false,
  hideSubAgentCreate,
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
    <div className="h-full flex flex-col">
      <Tabs defaultTab="identity" className="flex-1 min-h-0 flex flex-col">
        <TabList className="flex-shrink-0">
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

        <TabContent value="identity" className="flex-1 min-h-0 py-0 pb-3">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-6 p-4">
              <SectionHeader title="Identity" subtitle="Define your agent's name, description, and model." />

              {/* Agent Name */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-name" className="text-xs text-icon5">
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
                {errors.name && <span className="text-xs text-accent2">{errors.name.message}</span>}
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="agent-description" className="text-xs text-icon5">
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
                {errors.description && <span className="text-xs text-accent2">{errors.description.message}</span>}
              </div>

              {/* Provider */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-icon5">
                  Provider <span className="text-accent2">*</span>
                </Label>
                <Controller
                  name="model.provider"
                  control={control}
                  render={({ field }) => (
                    <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                      <LLMProviders
                        value={field.value}
                        onValueChange={field.onChange}
                        variant="light"
                        container={formRef}
                      />
                    </div>
                  )}
                />
                {errors.model?.provider && (
                  <span className="text-xs text-accent2">{errors.model.provider.message}</span>
                )}
              </div>

              {/* Model */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-icon5">
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
                        variant="light"
                        container={formRef}
                      />
                    </div>
                  )}
                />
                {errors.model?.name && <span className="text-xs text-accent2">{errors.model.name.message}</span>}
              </div>
            </div>
          </ScrollArea>
        </TabContent>

        <TabContent value="capabilities" className="flex-1 min-h-0 py-0 pb-3">
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
                hideCreateButton={hideSubAgentCreate}
              />
              <ScorersSection control={control} readOnly={readOnly} />
              <MemorySection control={control} setValue={form.setValue} readOnly={readOnly} />
            </div>
          </ScrollArea>
        </TabContent>

        <TabContent value="variables" className="flex-1 min-h-0 py-0 pb-3">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-6 p-4 border-b border-border1">
              <SectionHeader
                title="Variables"
                subtitle={
                  <>
                    Variables are dynamic values that change based on the context of each request. Use them in your
                    agent's instructions with the{' '}
                    <code className="text-[#F59E0B] font-medium">{'{{variableName}}'}</code> syntax.
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
          </ScrollArea>
        </TabContent>
      </Tabs>

      {/* Sticky footer with Create/Update Agent button */}
      {!readOnly && (
        <div className="flex-shrink-0 p-4">
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

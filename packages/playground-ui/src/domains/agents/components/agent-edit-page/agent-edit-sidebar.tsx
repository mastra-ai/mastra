import { useState, type RefObject } from 'react';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import { Check } from 'lucide-react';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { Tabs, TabList, Tab, TabContent } from '@/ds/components/Tabs';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { Spinner } from '@/ds/components/Spinner';
import type { SchemaField } from '@/ds/components/JSONSchemaForm';
import { Input } from '@/ds/components/Input';
import { Textarea } from '@/ds/components/Textarea';
import { Label } from '@/ds/components/Label';
import { SectionHeader } from '@/domains/cms';

import { LLMProviders, LLMModels } from '@/domains/llm';

import type { AgentFormValues } from '../agent-edit/form-validation';
import { ToolsSection, WorkflowsSection, AgentsSection, ScorersSection } from './sections';
import { VariableDialog } from './variable-dialog';

interface AgentEditSidebarProps {
  form: UseFormReturn<AgentFormValues>;
  currentAgentId?: string;
  onPublish: () => void;
  isSubmitting?: boolean;
  formRef?: RefObject<HTMLFormElement | null>;
  mode?: 'create' | 'edit';
}

export function AgentEditSidebar({
  form,
  currentAgentId,
  onPublish,
  isSubmitting = false,
  formRef,
  mode = 'create',
}: AgentEditSidebarProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  const watchedVariables = useWatch({ control, name: 'variables' });

  // Variable dialog state
  const [isVariableDialogOpen, setIsVariableDialogOpen] = useState(false);

  const handleSaveVariables = (fields: SchemaField[]) => {
    form.setValue('variables', fields, { shouldDirty: true });
    setIsVariableDialogOpen(false);
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultTab="identity" className="flex-1 min-h-0 flex flex-col">
        <TabList className="flex-shrink-0">
          <Tab value="identity">Identity</Tab>
          <Tab value="capabilities">Capabilities</Tab>
        </TabList>

        <TabContent value="identity" className="flex-1 min-h-0">
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
                    <LLMProviders
                      value={field.value}
                      onValueChange={field.onChange}
                      variant="light"
                      container={formRef}
                    />
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
                    <LLMModels
                      value={field.value}
                      onValueChange={field.onChange}
                      llmId={form.watch('model.provider') || ''}
                      variant="light"
                      container={formRef}
                    />
                  )}
                />
                {errors.model?.name && <span className="text-xs text-accent2">{errors.model.name.message}</span>}
              </div>
            </div>
          </ScrollArea>
        </TabContent>

        <TabContent value="capabilities" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-6 p-4">
              <SectionHeader
                title="Capabilities"
                subtitle="Extend your agent with tools, workflows, and other resources to enhance its abilities."
              />

              <ToolsSection control={control} error={errors.tools?.root?.message} />
              <WorkflowsSection control={control} error={errors.workflows?.root?.message} />
              <AgentsSection control={control} error={errors.agents?.root?.message} currentAgentId={currentAgentId} />
              <ScorersSection control={control} />
            </div>
          </ScrollArea>
        </TabContent>
      </Tabs>

      {/* Sticky footer with Pregenerate and Create/Update Agent buttons */}
      <div className="flex-shrink-0 p-4 border-t border-border1 flex flex-col gap-2">
        {/* <Button variant="outline" onClick={() => setIsVariableDialogOpen(true)} className="w-full" type="button">
          <Icon>
            <VariablesIcon />
          </Icon>
          Manage variables
        </Button> */}

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

      <VariableDialog
        isOpen={isVariableDialogOpen}
        onClose={() => setIsVariableDialogOpen(false)}
        defaultValue={watchedVariables ?? []}
        onSave={handleSaveVariables}
      />
    </div>
  );
}

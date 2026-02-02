'use client';

import { useMemo, useState, type RefObject } from 'react';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import { Check, Sparkles } from 'lucide-react';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { Tabs, TabList, Tab, TabContent } from '@/ds/components/Tabs';
import { Button } from '@/ds/components/Button';
import { Icon, VariablesIcon } from '@/ds/icons';
import { Spinner } from '@/ds/components/Spinner';
import type { SchemaField } from '@/ds/components/JSONSchemaForm';
import { Input } from '@/ds/components/Input';
import { Textarea } from '@/ds/components/Textarea';
import { Label } from '@/ds/components/Label';
import { SectionHeader } from '@/domains/cms';
import { toast } from '@/lib/toast';

import { LLMProviders, LLMModels } from '@/domains/llm';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { useAgents } from '../../hooks/use-agents';
import { usePregenerateAgentConfig } from '../../hooks/use-pregenerate-agent-config';
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

  // Watch form values needed for pregenerate
  const watchedName = useWatch({ control, name: 'name' });
  const watchedDescription = useWatch({ control, name: 'description' });
  const watchedProvider = useWatch({ control, name: 'model.provider' });
  const watchedModel = useWatch({ control, name: 'model.name' });
  const watchedVariables = useWatch({ control, name: 'variables' });

  // Variable dialog state
  const [isVariableDialogOpen, setIsVariableDialogOpen] = useState(false);

  const handleSaveVariables = (fields: SchemaField[]) => {
    form.setValue('variables', fields, { shouldDirty: true });
    setIsVariableDialogOpen(false);
  };

  // Fetch available resources
  const { data: tools } = useTools();
  const { data: workflows } = useWorkflows();
  const { data: agents } = useAgents();
  const { data: scorers } = useScorers();

  // Pregenerate mutation
  const { mutate: pregenerate, isPending: isPregenerating } = usePregenerateAgentConfig();

  // Check if pregenerate button should be enabled
  const canPregenerate = Boolean(
    watchedName?.trim() && watchedDescription?.trim() && watchedProvider?.trim() && watchedModel?.trim(),
  );

  // Transform available resources for the pregenerate API
  const availableTools = useMemo(() => {
    if (!tools) return [];
    return Object.entries(tools).map(([id, tool]) => ({
      id,
      name: (tool as { name?: string }).name || id,
      description: (tool as { description?: string }).description,
    }));
  }, [tools]);

  const availableWorkflows = useMemo(() => {
    if (!workflows) return [];
    return Object.entries(workflows).map(([id, workflow]) => ({
      id,
      name: (workflow as { name?: string }).name || id,
      description: (workflow as { description?: string }).description,
    }));
  }, [workflows]);

  const availableAgents = useMemo(() => {
    if (!agents) return [];
    const agentList = Array.isArray(agents)
      ? agents
      : Object.entries(agents).map(([id, agent]) => ({
          id,
          name: (agent as { name?: string }).name || id,
        }));
    // Filter out current agent
    return agentList
      .filter(agent => agent.id !== currentAgentId)
      .map(agent => ({
        id: agent.id,
        name: agent.name || agent.id,
        description: undefined,
      }));
  }, [agents, currentAgentId]);

  const availableScorers = useMemo(() => {
    if (!scorers) return [];
    return Object.entries(scorers).map(([id, scorer]) => ({
      id,
      name: (scorer as { scorer?: { config?: { name?: string } } }).scorer?.config?.name || id,
      description: (scorer as { scorer?: { config?: { description?: string } } }).scorer?.config?.description,
    }));
  }, [scorers]);

  const handlePregenerate = () => {
    if (!canPregenerate) return;

    pregenerate(
      {
        name: watchedName!,
        description: watchedDescription!,
        model: {
          provider: watchedProvider!,
          name: watchedModel!,
        },
        availableTools,
        availableWorkflows,
        availableAgents,
        availableScorers,
      },
      {
        onSuccess: data => {
          // Populate form fields with generated configuration
          // Note: fields can be null (for JSON Schema compatibility) so check explicitly
          if (data.instructions) {
            form.setValue('instructions', data.instructions);
          }
          // Convert tool IDs array to the record format expected by the form
          if (data.tools && data.tools.length > 0) {
            const toolsRecord: Record<string, { description?: string }> = {};
            for (const toolId of data.tools) {
              const tool = availableTools.find(t => t.id === toolId);
              toolsRecord[toolId] = { description: tool?.description };
            }
            form.setValue('tools', toolsRecord);
          }
          // Convert workflow IDs array to the record format expected by the form
          if (data.workflows && data.workflows.length > 0) {
            const workflowsRecord: Record<string, { description?: string }> = {};
            for (const workflowId of data.workflows) {
              const workflow = availableWorkflows.find(w => w.id === workflowId);
              workflowsRecord[workflowId] = { description: workflow?.description };
            }
            form.setValue('workflows', workflowsRecord);
          }
          // Convert agent IDs array to the record format expected by the form
          if (data.agents && data.agents.length > 0) {
            const agentsRecord: Record<string, { description?: string }> = {};
            for (const agentId of data.agents) {
              const agent = availableAgents.find(a => a.id === agentId);
              agentsRecord[agentId] = { description: agent?.description };
            }
            form.setValue('agents', agentsRecord);
          }
          // Convert scorer IDs array to the record format expected by the form
          // Users can configure sampling manually after generation
          if (data.scorers && data.scorers.length > 0) {
            const scorersRecord: Record<string, { description?: string; sampling?: { type: 'ratio' | 'count'; rate?: number; count?: number } }> = {};
            for (const scorerId of data.scorers) {
              const scorer = availableScorers.find(s => s.id === scorerId);
              scorersRecord[scorerId] = { description: scorer?.description };
            }
            form.setValue('scorers', scorersRecord);
          }
          // Note: memory is a string suggestion, the user can decide to enable it manually
          toast.success('Configuration generated successfully');
        },
      },
    );
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
        <Button variant="outline" onClick={() => setIsVariableDialogOpen(true)} className="w-full" type="button">
          <Icon>
            <VariablesIcon />
          </Icon>
          Manage variables
        </Button>
        {mode !== 'edit' && (
          <Button
            variant="outline"
            onClick={handlePregenerate}
            disabled={!canPregenerate || isPregenerating}
            className="w-full"
            type="button"
          >
            {isPregenerating ? (
              <>
                <Spinner className="h-4 w-4" />
                Generating...
              </>
            ) : (
              <>
                <Icon>
                  <Sparkles />
                </Icon>
                Pregenerate Configuration
              </>
            )}
          </Button>
        )}
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

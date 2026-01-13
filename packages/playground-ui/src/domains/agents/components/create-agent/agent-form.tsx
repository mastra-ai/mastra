'use client';

import * as React from 'react';
import { useForm, Controller, Resolver } from 'react-hook-form';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

import { Button } from '@/ds/components/Button';
import { Badge } from '@/ds/components/Badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import Spinner from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import { useAgents } from '../../hooks/use-agents';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { useMemoryConfigs } from '@/domains/memory/hooks';

import { ModelPicker } from './model-picker';
import { MultiSelectPicker } from './multi-select-picker';
import { InstructionsEnhancer } from './instructions-enhancer';
import type { AgentFormValues } from './form-validation';

// Simple validation resolver without zod to avoid version conflicts
const agentFormResolver: Resolver<AgentFormValues> = async values => {
  const errors: Record<string, { type: string; message: string }> = {};

  if (!values.name || values.name.trim() === '') {
    errors.name = { type: 'required', message: 'Name is required' };
  } else if (values.name.length > 100) {
    errors.name = { type: 'maxLength', message: 'Name must be 100 characters or less' };
  }

  if (values.description && values.description.length > 500) {
    errors.description = { type: 'maxLength', message: 'Description must be 500 characters or less' };
  }

  if (!values.instructions || values.instructions.trim() === '') {
    errors.instructions = { type: 'required', message: 'Instructions are required' };
  }

  if (!values.model?.provider || values.model.provider.trim() === '') {
    errors['model.provider'] = { type: 'required', message: 'Provider is required' };
  }

  if (!values.model?.name || values.model.name.trim() === '') {
    errors['model.name'] = { type: 'required', message: 'Model is required' };
  }

  return {
    values: Object.keys(errors).length === 0 ? values : {},
    errors: Object.keys(errors).length > 0 ? errors : {},
  };
};

export interface AgentFormProps {
  mode: 'create' | 'edit';
  agentId?: string;
  initialValues?: Partial<AgentFormValues>;
  onSubmit: (values: AgentFormValues) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
  isSubmitting?: boolean;
  isDeleting?: boolean;
  excludeAgentId?: string;
}

export function AgentForm({
  mode,
  agentId,
  initialValues,
  onSubmit,
  onCancel,
  onDelete,
  isSubmitting = false,
  isDeleting = false,
  excludeAgentId,
}: AgentFormProps) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // Data fetching
  const { data: tools, isLoading: toolsLoading } = useTools();
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows();
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: memoryConfigsData, isLoading: memoryConfigsLoading } = useMemoryConfigs();

  // Form setup
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<AgentFormValues>({
    resolver: agentFormResolver,
    defaultValues: {
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
      instructions: initialValues?.instructions ?? '',
      model: initialValues?.model ?? { provider: '', name: '' },
      tools: initialValues?.tools ?? [],
      workflows: initialValues?.workflows ?? [],
      agents: initialValues?.agents ?? [],
      memory: initialValues?.memory ?? '',
    },
  });

  // Filter out current agent from sub-agents picker
  const availableAgents = React.useMemo(() => {
    if (!agents) return [];
    const agentList = Array.isArray(agents)
      ? agents
      : Object.entries(agents).map(([id, agent]) => ({
          id,
          name: (agent as { name?: string }).name || id,
        }));
    return agentList.filter(agent => agent.id !== excludeAgentId && agent.id !== agentId);
  }, [agents, excludeAgentId, agentId]);

  // Transform tools data
  const toolOptions = React.useMemo(() => {
    if (!tools) return [];
    return Object.entries(tools).map(([id, tool]) => ({
      id,
      name: (tool as { name?: string }).name || id,
      description: (tool as { description?: string }).description || '',
    }));
  }, [tools]);

  // Transform workflows data
  const workflowOptions = React.useMemo(() => {
    if (!workflows) return [];
    return Object.entries(workflows).map(([id, workflow]) => ({
      id,
      name: (workflow as { name?: string }).name || id,
      description: (workflow as { description?: string }).description || '',
    }));
  }, [workflows]);

  // Transform agents data for sub-agents picker
  const agentOptions = React.useMemo(() => {
    return availableAgents.map(agent => ({
      id: agent.id,
      name: agent.name || agent.id,
      description: '',
    }));
  }, [availableAgents]);

  // Transform memory configs data
  const memoryOptions = React.useMemo(() => {
    if (!memoryConfigsData?.configs) return [];
    return memoryConfigsData.configs.map(config => ({
      id: config.id,
      name: config.name || config.id,
      description: '',
    }));
  }, [memoryConfigsData]);

  const handleFormSubmit = async (values: AgentFormValues) => {
    await onSubmit(values);
  };

  const isLoading = toolsLoading || workflowsLoading || agentsLoading || memoryConfigsLoading;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-6">
      {/* Agent ID badge in edit mode */}
      {mode === 'edit' && agentId && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-icon3">ID:</span>
          <Badge>{agentId}</Badge>
        </div>
      )}

      {/* Basic Fields - Always Visible */}
      <div className="flex flex-col gap-4">
        {/* Name */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="name" className="text-icon5">
            Name <span className="text-accent2">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Enter agent name"
            {...register('name')}
            className={cn(errors.name && 'border-accent2')}
          />
          {errors.name && <span className="text-xs text-accent2">{errors.name.message}</span>}
        </div>

        {/* Description */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="description" className="text-icon5">
            Description
          </Label>
          <Input
            id="description"
            placeholder="Enter agent description (optional)"
            {...register('description')}
            className={cn(errors.description && 'border-accent2')}
          />
          {errors.description && <span className="text-xs text-accent2">{errors.description.message}</span>}
        </div>

        {/* Model */}
        <div className="flex flex-col gap-2">
          <Label className="text-icon5">
            Model <span className="text-accent2">*</span>
          </Label>
          <Controller
            name="model"
            control={control}
            render={({ field }) => (
              <ModelPicker
                value={field.value}
                onChange={field.onChange}
                error={errors.model?.provider?.message || errors.model?.name?.message}
              />
            )}
          />
        </div>

        {/* Instructions */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="instructions" className="text-icon5">
            Instructions <span className="text-accent2">*</span>
          </Label>
          <Controller
            name="instructions"
            control={control}
            render={({ field }) => (
              <InstructionsEnhancer
                value={field.value}
                onChange={field.onChange}
                agentId={mode === 'edit' ? agentId : undefined}
                placeholder="Enter agent instructions"
                error={errors.instructions?.message}
              />
            )}
          />
        </div>
      </div>

      {/* Advanced Section - Collapsible */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-icon5 hover:text-icon6 transition-colors w-full">
          {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span>Advanced Settings</span>
          {isLoading && <Spinner className="h-3 w-3" />}
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-4">
          <div className="flex flex-col gap-4 pl-6 border-l border-border1">
            {/* Tools */}
            <Controller
              name="tools"
              control={control}
              render={({ field }) => (
                <MultiSelectPicker
                  label="Tools"
                  options={toolOptions}
                  selected={field.value || []}
                  onChange={field.onChange}
                  getOptionId={option => option.id}
                  getOptionLabel={option => option.name}
                  getOptionDescription={option => option.description}
                  placeholder="Select tools..."
                  searchPlaceholder="Search tools..."
                  emptyMessage="No tools available"
                  disabled={toolsLoading}
                  error={errors.tools?.message}
                />
              )}
            />

            {/* Workflows */}
            <Controller
              name="workflows"
              control={control}
              render={({ field }) => (
                <MultiSelectPicker
                  label="Workflows"
                  options={workflowOptions}
                  selected={field.value || []}
                  onChange={field.onChange}
                  getOptionId={option => option.id}
                  getOptionLabel={option => option.name}
                  getOptionDescription={option => option.description}
                  placeholder="Select workflows..."
                  searchPlaceholder="Search workflows..."
                  emptyMessage="No workflows available"
                  disabled={workflowsLoading}
                  error={errors.workflows?.message}
                />
              )}
            />

            {/* Sub-Agents */}
            <Controller
              name="agents"
              control={control}
              render={({ field }) => (
                <MultiSelectPicker
                  label="Sub-Agents"
                  options={agentOptions}
                  selected={field.value || []}
                  onChange={field.onChange}
                  getOptionId={option => option.id}
                  getOptionLabel={option => option.name}
                  getOptionDescription={option => option.description}
                  placeholder="Select sub-agents..."
                  searchPlaceholder="Search agents..."
                  emptyMessage="No agents available"
                  disabled={agentsLoading}
                  error={errors.agents?.message}
                />
              )}
            />

            {/* Memory - Single Select */}
            <Controller
              name="memory"
              control={control}
              render={({ field }) => (
                <MultiSelectPicker
                  label="Memory"
                  options={memoryOptions}
                  selected={field.value ? [field.value] : []}
                  onChange={selected => field.onChange(selected[0] || '')}
                  getOptionId={option => option.id}
                  getOptionLabel={option => option.name}
                  getOptionDescription={option => option.description}
                  placeholder="Select memory configuration..."
                  searchPlaceholder="Search memory configs..."
                  emptyMessage="No memory configurations registered"
                  disabled={memoryConfigsLoading}
                  singleSelect={true}
                  error={errors.memory?.message}
                />
              )}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border1">
        <div>
          {mode === 'edit' && onDelete && (
            <Button
              type="button"
              variant="ghost"
              onClick={onDelete}
              disabled={isDeleting || isSubmitting}
              className="text-accent2 hover:text-accent2 hover:bg-accent2/10"
            >
              {isDeleting ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting || isDeleting}>
            Cancel
          </Button>
          <Button type="submit" variant="light" disabled={isSubmitting || isDeleting}>
            {isSubmitting ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                {mode === 'create' ? 'Creating...' : 'Saving...'}
              </>
            ) : mode === 'create' ? (
              'Create Agent'
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

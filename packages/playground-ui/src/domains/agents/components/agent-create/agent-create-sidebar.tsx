'use client';

import { Controller } from 'react-hook-form';

import { Section } from '@/domains/cms';
import { Spinner } from '@/ds/components/Spinner';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { ToolsIcon, WorkflowIcon, AgentIcon, MemoryIcon, JudgeIcon } from '@/ds/icons';

import { MultiSelectPicker } from '../create-agent/multi-select-picker';
import { ScorersPicker } from '../create-agent/scorers-picker';
import { useAgentCreateContext } from './agent-create-context';

export function AgentCreateSidebar() {
  const {
    form,
    toolOptions,
    workflowOptions,
    agentOptions,
    memoryOptions,
    scorerOptions,
    toolsLoading,
    workflowsLoading,
    agentsLoading,
    memoryConfigsLoading,
    scorersLoading,
    isLoading,
  } = useAgentCreateContext();

  const { control, formState: { errors } } = form;

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 p-4">
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Spinner className="h-5 w-5" />
          </div>
        )}

        {/* Tools */}
        <Section title={<Section.Title icon={<ToolsIcon className="text-accent5" />}>Tools</Section.Title>}>
          <Controller
            name="tools"
            control={control}
            render={({ field }) => (
              <MultiSelectPicker
                label=""
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
        </Section>

        {/* Workflows */}
        <Section title={<Section.Title icon={<WorkflowIcon className="text-accent1" />}>Workflows</Section.Title>}>
          <Controller
            name="workflows"
            control={control}
            render={({ field }) => (
              <MultiSelectPicker
                label=""
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
        </Section>

        {/* Sub-Agents */}
        <Section title={<Section.Title icon={<AgentIcon className="text-accent6" />}>Sub-Agents</Section.Title>}>
          <Controller
            name="agents"
            control={control}
            render={({ field }) => (
              <MultiSelectPicker
                label=""
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
        </Section>

        {/* Memory */}
        <Section title={<Section.Title icon={<MemoryIcon className="text-accent5" />}>Memory</Section.Title>}>
          <Controller
            name="memory"
            control={control}
            render={({ field }) => (
              <MultiSelectPicker<{ id: string; name: string; description: string }>
                label=""
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
        </Section>

        {/* Scorers */}
        <Section title={<Section.Title icon={<JudgeIcon className="text-accent2" />}>Scorers</Section.Title>}>
          <Controller
            name="scorers"
            control={control}
            render={({ field }) => (
              <ScorersPicker
                selected={field.value || {}}
                onChange={field.onChange}
                options={scorerOptions}
                disabled={scorersLoading}
              />
            )}
          />
        </Section>
      </div>
    </ScrollArea>
  );
}

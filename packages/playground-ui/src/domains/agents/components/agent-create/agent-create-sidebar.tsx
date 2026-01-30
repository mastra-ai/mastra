'use client';

import { Controller } from 'react-hook-form';

import { Section } from '@/ds/components/Section';
import { Spinner } from '@/ds/components/Spinner';
import { ScrollArea } from '@/ds/components/ScrollArea';

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
        <Section>
          <Section.Header>
            <Section.Heading headingLevel="h3">Tools</Section.Heading>
          </Section.Header>
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
        <Section>
          <Section.Header>
            <Section.Heading headingLevel="h3">Workflows</Section.Heading>
          </Section.Header>
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
        <Section>
          <Section.Header>
            <Section.Heading headingLevel="h3">Sub-Agents</Section.Heading>
          </Section.Header>
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
        <Section>
          <Section.Header>
            <Section.Heading headingLevel="h3">Memory</Section.Heading>
          </Section.Header>
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
        <Section>
          <Section.Header>
            <Section.Heading headingLevel="h3">Scorers</Section.Heading>
          </Section.Header>
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

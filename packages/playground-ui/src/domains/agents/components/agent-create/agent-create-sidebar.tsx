'use client';

import type { UseFormReturn } from 'react-hook-form';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { SectionHeader } from '@/domains/cms';

import type { AgentFormValues } from '../create-agent/form-validation';
import { ToolsSection, WorkflowsSection, AgentsSection, MemorySection, ScorersSection } from './sections';

interface AgentCreateSidebarProps {
  form: UseFormReturn<AgentFormValues>;
  currentAgentId?: string;
}

export function AgentCreateSidebar({ form, currentAgentId }: AgentCreateSidebarProps) {
  const {
    control,
    formState: { errors },
  } = form;

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 p-4">
        <SectionHeader
          title="Capabilities"
          subtitle="Extend your agent with tools, workflows, and other resources to enhance its abilities."
        />

        <ToolsSection control={control} error={errors.tools?.message} />
        <WorkflowsSection control={control} error={errors.workflows?.message} />
        <AgentsSection control={control} error={errors.agents?.message} currentAgentId={currentAgentId} />
        <MemorySection control={control} error={errors.memory?.message} />
        <ScorersSection control={control} />
      </div>
    </ScrollArea>
  );
}

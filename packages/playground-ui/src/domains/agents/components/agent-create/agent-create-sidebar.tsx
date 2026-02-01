'use client';

import type { UseFormReturn } from 'react-hook-form';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { Tabs, TabList, Tab, TabContent } from '@/ds/components/Tabs';
import { SectionHeader } from '@/domains/cms';

import type { AgentFormValues } from '../create-agent/form-validation';
import { ToolsSection, WorkflowsSection, AgentsSection, MemorySection, ScorersSection } from './sections';
import { RevisionsTabContent } from './revisions';

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
    <Tabs defaultTab="capabilities" className="h-full flex flex-col">
      <TabList className="flex-shrink-0">
        <Tab value="capabilities">Capabilities</Tab>
        <Tab value="revisions">Revisions</Tab>
      </TabList>

      <TabContent value="capabilities" className="flex-1 min-h-0">
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
      </TabContent>

      <TabContent value="revisions" className="flex-1 min-h-0">
        <RevisionsTabContent agentId={currentAgentId} currentInstructions={form.watch('instructions')} />
      </TabContent>
    </Tabs>
  );
}

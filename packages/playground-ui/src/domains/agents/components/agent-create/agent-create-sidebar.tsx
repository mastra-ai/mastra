'use client';

import type { RefObject } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { Check } from 'lucide-react';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { Tabs, TabList, Tab, TabContent } from '@/ds/components/Tabs';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { Spinner } from '@/ds/components/Spinner';
import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { SectionHeader } from '@/domains/cms';

import { LLMProviders, LLMModels } from '@/domains/llm';
import type { AgentFormValues } from '../create-agent/form-validation';
import { ToolsSection, WorkflowsSection, AgentsSection, MemorySection, ScorersSection } from './sections';
import { RevisionsTabContent } from './revisions';

interface AgentCreateSidebarProps {
  form: UseFormReturn<AgentFormValues>;
  currentAgentId?: string;
  onPublish: () => void;
  isSubmitting?: boolean;
  formRef?: RefObject<HTMLFormElement | null>;
}

export function AgentCreateSidebar({
  form,
  currentAgentId,
  onPublish,
  isSubmitting = false,
  formRef,
}: AgentCreateSidebarProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultTab="identity" className="flex-1 min-h-0 flex flex-col">
        <TabList className="flex-shrink-0">
          <Tab value="identity">Identity</Tab>
          <Tab value="capabilities">Capabilities</Tab>
          <Tab value="revisions">Revisions</Tab>
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
                <Input
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

      {/* Sticky footer with Create Agent button */}
      <div className="flex-shrink-0 p-4 border-t border-border1">
        <Button variant="primary" onClick={onPublish} disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <>
              <Spinner className="h-4 w-4" />
              Creating...
            </>
          ) : (
            <>
              <Icon>
                <Check />
              </Icon>
              Create agent
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

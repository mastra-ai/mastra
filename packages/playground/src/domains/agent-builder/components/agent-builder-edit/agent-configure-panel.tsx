import {
  Avatar,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Txt,
} from '@mastra/playground-ui';
import { ChevronRight, GraduationCap, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { findModelOption, getModelOptionKey, modelOptionsFixture, skillsFixture, toolsFixture } from '../../fixtures';
import type { AgentFixture } from '../../fixtures';
import { SkillsDialog } from './dialogs/skills-dialog';
import { SystemPromptDialog } from './dialogs/system-prompt-dialog';
import { ToolsDialog } from './dialogs/tools-dialog';

const INTEGRATIONS = ['Slack', 'Teams', 'Discord'];

interface AgentConfigurePanelProps {
  agent: AgentFixture;
  onAgentChange: (next: AgentFixture) => void;
}

export const AgentConfigurePanel = ({ agent, onAgentChange }: AgentConfigurePanelProps) => {
  const [systemPromptOpen, setSystemPromptOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);

  const activeToolsCount = useMemo(() => toolsFixture.filter(t => t.enabled).length, []);
  const activeSkillsCount = useMemo(() => skillsFixture.filter(s => s.enabled).length, []);

  const modelValue = getModelOptionKey({
    providerId: agent.modelProviderId,
    providerName: '',
    modelId: agent.modelId,
    label: '',
  });

  const handleModelChange = (value: string) => {
    const option = findModelOption(value);
    if (!option) return;
    onAgentChange({ ...agent, modelProviderId: option.providerId, modelId: option.modelId });
  };

  const handleSystemPromptSave = (nextPrompt: string) => {
    onAgentChange({ ...agent, systemPrompt: nextPrompt });
    setSystemPromptOpen(false);
  };

  return (
    <div className="flex flex-col gap-8 p-6 h-full border border-border1 bg-surface3 overflow-y-auto rounded-3xl">
      <div className="flex items-center gap-3">
        <Avatar name={agent.name} size="sm" src={agent.avatarUrl} />
        <Txt variant="ui-sm" className="font-medium text-neutral6">
          {agent.name}
        </Txt>
      </div>

      <Section
        label="Instructions"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSystemPromptOpen(true)}
            data-testid="agent-preview-edit-system-prompt"
          >
            Edit
          </Button>
        }
      >
        <Txt variant="ui-sm" className="whitespace-pre-wrap leading-relaxed text-neutral4">
          {agent.systemPrompt}
        </Txt>
      </Section>

      <Section label="Model">
        <Select value={modelValue} onValueChange={handleModelChange}>
          <SelectTrigger size="md" data-testid="agent-preview-model-trigger">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {modelOptionsFixture.map(option => {
              const key = getModelOptionKey(option);
              return (
                <SelectItem key={key} value={key}>
                  <span className="text-neutral3">{option.providerName}</span>
                  <span className="mx-1 text-neutral2">/</span>
                  <span className="text-neutral6">{option.label}</span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </Section>

      <Section label="Capabilities">
        <div className="flex flex-col">
          <CapabilityRow
            icon={<Wrench className="h-4 w-4" />}
            label="Tools"
            description="External actions your agent can take"
            count={activeToolsCount}
            total={toolsFixture.length}
            onClick={() => setToolsOpen(true)}
            testId="agent-preview-tools-button"
          />
          <CapabilityRow
            icon={<GraduationCap className="h-4 w-4" />}
            label="Skills"
            description="Reusable knowledge and behaviors"
            count={activeSkillsCount}
            total={skillsFixture.length}
            onClick={() => setSkillsOpen(true)}
            testId="agent-preview-skills-button"
          />
        </div>
      </Section>

      <Section label="Channels">
        <div className="flex flex-wrap items-center gap-2">
          {INTEGRATIONS.map(channel => (
            <span
              key={channel}
              className="inline-flex items-center rounded-full border border-border1 px-3 py-1 text-ui-xs text-neutral4"
            >
              {channel}
            </span>
          ))}
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-dashed border-border1 px-3 py-1 text-ui-xs text-neutral3 transition-colors hover:border-border2 hover:text-neutral5"
          >
            + Add channel
          </button>
        </div>
      </Section>

      <SystemPromptDialog
        open={systemPromptOpen}
        onOpenChange={setSystemPromptOpen}
        prompt={agent.systemPrompt}
        onSave={handleSystemPromptSave}
      />
      <ToolsDialog open={toolsOpen} onOpenChange={setToolsOpen} />
      <SkillsDialog open={skillsOpen} onOpenChange={setSkillsOpen} />
    </div>
  );
};

interface SectionProps {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

const Section = ({ label, action, children }: SectionProps) => (
  <section className="flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <Txt variant="ui-xs" className="font-medium uppercase tracking-wider text-neutral3">
        {label}
      </Txt>
      {action}
    </div>
    {children}
  </section>
);

interface CapabilityRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  count: number;
  total: number;
  onClick: () => void;
  testId: string;
}

const CapabilityRow = ({ icon, label, description, count, total, onClick, testId }: CapabilityRowProps) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId}
    className="group flex items-center gap-4 border-b border-border1 py-4 text-left transition-colors first:border-t hover:bg-surface2"
  >
    <span className="text-neutral3 transition-colors group-hover:text-neutral5">{icon}</span>
    <div className="flex flex-1 flex-col gap-0.5">
      <Txt variant="ui-sm" className="font-medium text-neutral6">
        {label}
      </Txt>
      <Txt variant="ui-xs" className="text-neutral3">
        {description}
      </Txt>
    </div>
    <Txt variant="ui-sm" className="font-mono text-neutral3">
      {count} / {total}
    </Txt>
    <ChevronRight className="h-4 w-4 text-neutral3 transition-colors group-hover:text-neutral5" />
  </button>
);

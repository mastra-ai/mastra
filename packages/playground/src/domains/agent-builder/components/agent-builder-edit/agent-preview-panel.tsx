import {
  Avatar,
  Badge,
  Button,
  Card,
  IconButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Txt,
} from '@mastra/playground-ui';
import { MessageSquareCode, PencilIcon, Wrench, GraduationCap, SendIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  defaultAgentFixture,
  findModelOption,
  getModelOptionKey,
  modelOptionsFixture,
  skillsFixture,
  toolsFixture,
  type AgentFixture,
} from '../../fixtures';
import { SystemPromptDialog } from './dialogs/system-prompt-dialog';
import { ToolsDialog } from './dialogs/tools-dialog';
import { SkillsDialog } from './dialogs/skills-dialog';

const INTEGRATIONS = [
  { id: 'slack', label: 'Slack' },
  { id: 'teams', label: 'Teams' },
  { id: 'discord', label: 'Discord' },
];

export const AgentPreviewPanel = () => {
  const [agent, setAgent] = useState<AgentFixture>(defaultAgentFixture);
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
    setAgent(prev => ({ ...prev, modelProviderId: option.providerId, modelId: option.modelId }));
  };

  const handleSystemPromptSave = (nextPrompt: string) => {
    setAgent(prev => ({ ...prev, systemPrompt: nextPrompt }));
    setSystemPromptOpen(false);
  };

  const promptPreview = truncatePrompt(agent.systemPrompt);

  return (
    <div className="flex h-full min-h-0 flex-col px-6 py-6">
      <Card elevation="elevated" className="flex flex-1 min-h-0 flex-col overflow-hidden">
        <div className="flex items-start gap-4 border-b border-border1 p-6">
          <Avatar name={agent.name} size="lg" src={agent.avatarUrl} />
          <div className="flex flex-1 flex-col gap-2">
            <Txt variant="header-md" as="h2" className="text-neutral6">
              {agent.name}
            </Txt>
            <Txt variant="ui-sm" className="text-neutral3">
              {agent.description}
            </Txt>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Txt variant="ui-xs" className="text-neutral3">
                Deploy on
              </Txt>
              {INTEGRATIONS.map(integration => (
                <Badge key={integration.id} variant="default">
                  <SendIcon className="h-3 w-3" />
                  {integration.label}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <div className="flex flex-col gap-6">
            <Section
              title="System prompt"
              icon={<MessageSquareCode className="h-4 w-4" />}
              action={
                <IconButton
                  size="sm"
                  variant="ghost"
                  tooltip="Edit system prompt"
                  onClick={() => setSystemPromptOpen(true)}
                  data-testid="agent-preview-edit-system-prompt"
                >
                  <PencilIcon />
                </IconButton>
              }
            >
              <div className="rounded-md border border-border1 bg-surface2 p-4">
                <Txt variant="ui-sm" className="whitespace-pre-wrap text-neutral5">
                  {promptPreview}
                </Txt>
              </div>
            </Section>

            <Section title="Model" icon={<ModelIcon />}>
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

            <Section title="Capabilities" icon={<Wrench className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-3">
                <CapabilityButton
                  label="Tools"
                  count={activeToolsCount}
                  total={toolsFixture.length}
                  icon={<Wrench className="h-4 w-4" />}
                  onClick={() => setToolsOpen(true)}
                  testId="agent-preview-tools-button"
                />
                <CapabilityButton
                  label="Skills"
                  count={activeSkillsCount}
                  total={skillsFixture.length}
                  icon={<GraduationCap className="h-4 w-4" />}
                  onClick={() => setSkillsOpen(true)}
                  testId="agent-preview-skills-button"
                />
              </div>
            </Section>
          </div>
        </div>
      </Card>

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

const Section = ({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-neutral3">
        {icon}
        <Txt variant="ui-sm" className="font-medium uppercase tracking-wide">
          {title}
        </Txt>
      </div>
      {action}
    </div>
    {children}
  </section>
);

const CapabilityButton = ({
  label,
  count,
  total,
  icon,
  onClick,
  testId,
}: {
  label: string;
  count: number;
  total: number;
  icon: React.ReactNode;
  onClick: () => void;
  testId: string;
}) => (
  <Button variant="default" size="lg" onClick={onClick} data-testid={testId}>
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
      <Badge variant="default">
        {count} / {total}
      </Badge>
    </div>
  </Button>
);

const ModelIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
    aria-hidden
  >
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M9 9h6v6H9z" />
  </svg>
);

const PROMPT_PREVIEW_MAX_CHARS = 180;
const truncatePrompt = (prompt: string) => {
  const firstLine = prompt.split('\n')[0] ?? '';
  if (firstLine.length >= PROMPT_PREVIEW_MAX_CHARS) {
    return firstLine.slice(0, PROMPT_PREVIEW_MAX_CHARS).trimEnd() + '…';
  }
  if (prompt.length <= PROMPT_PREVIEW_MAX_CHARS) return prompt;
  return prompt.slice(0, PROMPT_PREVIEW_MAX_CHARS).trimEnd() + '…';
};

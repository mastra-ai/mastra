import {
  Avatar,
  Button,
  FieldBlock,
  IconButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TextFieldBlock,
  Txt,
} from '@mastra/playground-ui';
import { ChevronRight, FileText, GraduationCap, Plus, RadioIcon, Wrench, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  channelsFixture,
  findModelOption,
  getModelOptionKey,
  modelOptionsFixture,
  skillsFixture,
  toolsFixture,
} from '../../fixtures';
import type { AgentFixture } from '../../fixtures';
import type { AgentBuilderEditFormValues } from '../../schemas';
import { ChannelsDialog } from './dialogs/channels-dialog';
import { SkillsDialog } from './dialogs/skills-dialog';
import { SystemPromptDialog } from './dialogs/system-prompt-dialog';
import { ToolsDialog } from './dialogs/tools-dialog';

interface AgentConfigurePanelProps {
  agent: AgentFixture;
  onAgentChange: (next: AgentFixture) => void;
  editable?: boolean;
  draftName?: string;
  draftAvatarUrl?: string;
  onDraftNameChange?: (next: string) => void;
  onDraftAvatarUrlChange?: (next: string) => void;
  onClose: () => void;
}

export const AgentConfigurePanel = ({
  agent,
  onAgentChange,
  editable = true,
  draftName = agent.name,
  draftAvatarUrl = agent.avatarUrl ?? '',
  onDraftNameChange = () => {},
  onDraftAvatarUrlChange = () => {},
  onClose = () => {},
}: AgentConfigurePanelProps) => {
  const [systemPromptOpen, setSystemPromptOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onDraftAvatarUrlChange(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const activeToolsCount = useMemo(() => toolsFixture.filter(t => t.enabled).length, []);
  const activeSkillsCount = useMemo(() => skillsFixture.filter(s => s.enabled).length, []);
  const activeChannelsCount = useMemo(() => channelsFixture.filter(c => c.enabled).length, []);

  const trimmedDraftUrl = draftAvatarUrl.trim() || undefined;
  const isDirty = draftName.trim() !== agent.name || trimmedDraftUrl !== agent.avatarUrl;

  const handleSave = () => {
    onAgentChange({
      ...agent,
      name: draftName.trim() || agent.name,
      avatarUrl: trimmedDraftUrl,
    });
  };

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
    <div className="flex h-full flex-col border border-border1 bg-surface3 rounded-3xl overflow-hidden">
      <div className="pr-6 pt-6 flex justify-end">
        <IconButton onClick={onClose} className="rounded-full" tooltip="Close" variant="ghost">
          <X />
        </IconButton>
      </div>
      <div className="flex-1 flex flex-col gap-6 py-6 overflow-y-auto">
        {editable ? (
          <div className="flex items-center gap-4 px-6">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative h-avatar-lg w-avatar-lg shrink-0 overflow-hidden rounded-full border border-border1 bg-surface3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral3"
              aria-label="Upload avatar"
              data-testid="agent-configure-avatar-trigger"
            >
              {draftAvatarUrl ? (
                <img src={draftAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-ui-md text-neutral4">
                  {(draftName[0] ?? 'A').toUpperCase()}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-surface4 opacity-0 transition-opacity group-hover:opacity-100">
                <Plus className="h-5 w-5 text-neutral5" />
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFile}
              className="hidden"
              data-testid="agent-configure-avatar-input"
            />
            <div className="min-w-0 flex-1">
              <TextFieldBlock
                name="agent-name"
                label="Name"
                value={draftName}
                placeholder="My agent"
                onChange={e => onDraftNameChange(e.target.value)}
                testId="agent-configure-name"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-6">
            <Avatar name={agent.name} size="lg" src={agent.avatarUrl} />
            <Txt variant="ui-md" className="min-w-0 flex-1 truncate font-medium text-neutral6">
              {agent.name}
            </Txt>
          </div>
        )}

        <div className="px-6">
          <FieldBlock.Layout layout="vertical">
            <FieldBlock.Column>
              <FieldBlock.Label name="agent-model">Model</FieldBlock.Label>
              <Select value={modelValue} onValueChange={handleModelChange} disabled={!editable}>
                <SelectTrigger id="input-agent-model" size="md" data-testid="agent-preview-model-trigger">
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
            </FieldBlock.Column>
          </FieldBlock.Layout>
        </div>

        <div className="flex flex-col">
          <ConfigRow
            icon={<FileText className="h-4 w-4" />}
            label="Instructions"
            description={agent.systemPrompt}
            onClick={() => setSystemPromptOpen(true)}
            testId="agent-preview-edit-system-prompt"
          />
          <ConfigRow
            icon={<Wrench className="h-4 w-4" />}
            label="Tools"
            description="External actions your agent can take"
            count={activeToolsCount}
            total={toolsFixture.length}
            onClick={() => setToolsOpen(true)}
            testId="agent-preview-tools-button"
          />
          <ConfigRow
            icon={<GraduationCap className="h-4 w-4" />}
            label="Skills"
            description="Reusable knowledge and behaviors"
            count={activeSkillsCount}
            total={skillsFixture.length}
            onClick={() => setSkillsOpen(true)}
            testId="agent-preview-skills-button"
          />
          <ConfigRow
            icon={<RadioIcon className="h-4 w-4" />}
            label="Channels"
            description="Where this agent can be reached"
            count={activeChannelsCount}
            total={channelsFixture.length}
            onClick={() => setChannelsOpen(true)}
            testId="agent-preview-channels-button"
          />
        </div>
      </div>

      {editable && (
        <div className="shrink-0 border-t border-border1 px-6 py-4">
          <Button
            variant="default"
            className="w-full"
            onClick={handleSave}
            disabled={!isDirty}
            data-testid="agent-configure-save"
          >
            Save
          </Button>
        </div>
      )}

      <SystemPromptDialog
        open={systemPromptOpen}
        onOpenChange={setSystemPromptOpen}
        prompt={agent.systemPrompt}
        onSave={handleSystemPromptSave}
        editable={editable}
      />
      <ToolsDialog open={toolsOpen} onOpenChange={setToolsOpen} editable={editable} />
      <SkillsDialog open={skillsOpen} onOpenChange={setSkillsOpen} editable={editable} />
      <ChannelsDialog open={channelsOpen} onOpenChange={setChannelsOpen} editable={editable} />
    </div>
  );
};

interface ConfigRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  count?: number;
  total?: number;
  onClick: () => void;
  testId: string;
}

const ConfigRow = ({ icon, label, description, count, total, onClick, testId }: ConfigRowProps) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId}
    className="group flex items-center gap-4 border-b border-border1 px-6 py-4 text-left transition-colors first:border-t hover:bg-surface2"
  >
    <span className="shrink-0 text-neutral3 transition-colors group-hover:text-neutral5">{icon}</span>
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <Txt variant="ui-sm" className="font-medium text-neutral6">
        {label}
      </Txt>
      <Txt variant="ui-xs" className="truncate text-neutral3">
        {description}
      </Txt>
    </div>
    {count !== undefined && total !== undefined && (
      <Txt variant="ui-sm" className="shrink-0 font-mono text-neutral3">
        {count} / {total}
      </Txt>
    )}
    <ChevronRight className="h-4 w-4 shrink-0 text-neutral3 transition-colors group-hover:text-neutral5" />
  </button>
);

export const EditableAgentConfigurePanel = (props: AgentConfigurePanelProps) => {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const draftName = formMethods.watch('name');

  const setDraftName = (value: string) => formMethods.setValue('name', value);

  return (
    <AgentConfigurePanel
      {...props}
      editable={true}
      draftName={draftName}
      draftAvatarUrl={''}
      onDraftNameChange={setDraftName}
      onDraftAvatarUrlChange={() => {}}
    />
  );
};

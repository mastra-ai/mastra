import { Avatar, Skeleton, TextFieldBlock, Txt } from '@mastra/playground-ui';
import { ChevronRight, FileText, GraduationCap, Plus, Wrench } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useBuilderAgentFeatures } from '../../hooks/use-builder-agent-features';
import type { AgentBuilderEditFormValues } from '../../schemas';
import { SkillsDialog } from './dialogs/skills-dialog';
import { SystemPromptDialog } from './dialogs/system-prompt-dialog';
import { ToolsDialog } from './dialogs/tools-dialog';

export interface AvailableTool {
  id: string;
  description?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  systemPrompt: string;
}

interface AgentConfigurePanelProps {
  agent: AgentConfig;
  onAgentChange: (next: AgentConfig) => void;
  editable?: boolean;
  draftName?: string;
  draftDescription?: string;
  draftAvatarUrl?: string;
  draftInstructions?: string;
  onDraftNameChange?: (next: string) => void;
  onDraftDescriptionChange?: (next: string) => void;
  onDraftAvatarUrlChange?: (next: string) => void;
  onDraftInstructionsChange?: (next: string) => void;
  availableTools?: AvailableTool[];
  isLoading?: boolean;
}

export const AgentConfigurePanel = ({
  agent,
  onAgentChange,
  editable = true,
  draftName = agent.name,
  draftDescription = agent.description ?? '',
  draftAvatarUrl = agent.avatarUrl ?? '',
  draftInstructions = agent.systemPrompt,
  onDraftNameChange = () => {},
  onDraftDescriptionChange = () => {},
  onDraftAvatarUrlChange = () => {},
  onDraftInstructionsChange = () => {},
  availableTools = [],
  isLoading = false,
}: AgentConfigurePanelProps) => {
  const features = useBuilderAgentFeatures();
  const [systemPromptOpen, setSystemPromptOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
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

  const { control } = useFormContext<AgentBuilderEditFormValues>();
  const toolsMap = useWatch({ control, name: 'tools' });
  const activeToolsCount = useMemo(() => Object.values(toolsMap ?? {}).filter(Boolean).length, [toolsMap]);
  const totalToolsCount = availableTools.length;

  const handleSystemPromptSave = (nextPrompt: string) => {
    onDraftInstructionsChange(nextPrompt);
    onAgentChange({ ...agent, systemPrompt: nextPrompt });
    setSystemPromptOpen(false);
  };

  if (isLoading) {
    return <AgentConfigurePanelSkeleton />;
  }

  const trimmedInstructions = draftInstructions.trim();
  const instructionsDescription = trimmedInstructions.length === 0
    ? 'Set how your agent thinks and responds'
    : trimmedInstructions.length > 80
      ? `${trimmedInstructions.slice(0, 80).trimEnd()}…`
      : trimmedInstructions;

  return (
    <div className="flex h-full flex-col border border-border1 bg-surface2 rounded-3xl overflow-hidden">
      <div className="flex-1 flex flex-col gap-6 py-6 overflow-y-auto">
        {editable ? (
          <div className="flex flex-col gap-3 px-6">
            <div className="flex items-center gap-4">
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
                  placeholder="Untitled agent"
                  onChange={e => onDraftNameChange(e.target.value)}
                  testId="agent-configure-name"
                />
              </div>
            </div>
            <TextFieldBlock
              name="agent-description"
              label="Description"
              value={draftDescription}
              placeholder="What is this agent for?"
              onChange={e => onDraftDescriptionChange(e.target.value)}
              testId="agent-configure-description"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1 px-6">
            <div className="flex items-center gap-3">
              <Avatar name={agent.name} size="lg" src={agent.avatarUrl} />
              <Txt variant="ui-md" className="min-w-0 flex-1 truncate font-medium text-neutral6">
                {agent.name}
              </Txt>
            </div>
            {agent.description && (
              <Txt variant="ui-sm" className="text-neutral3" data-testid="agent-configure-description-view">
                {agent.description}
              </Txt>
            )}
          </div>
        )}

        <div className="flex flex-col divide-y divide-border1 border-t border-border1">
          <ConfigRow
            icon={<FileText className="h-4 w-4" />}
            label="Instructions"
            description={instructionsDescription}
            onClick={() => setSystemPromptOpen(true)}
            testId="agent-preview-edit-system-prompt"
          />
          {features.tools && (
            <ConfigRow
              icon={<Wrench className="h-4 w-4" />}
              label="Tools"
              description="External actions your agent can take"
              count={activeToolsCount}
              total={totalToolsCount}
              onClick={() => setToolsOpen(true)}
              testId="agent-preview-tools-button"
            />
          )}
          {features.skills && (
            <ConfigRow
              icon={<GraduationCap className="h-4 w-4" />}
              label="Skills"
              description="Reusable knowledge and behaviors"
              onClick={() => setSkillsOpen(true)}
              testId="agent-preview-skills-button"
            />
          )}
        </div>
      </div>

      <SystemPromptDialog
        open={systemPromptOpen}
        onOpenChange={setSystemPromptOpen}
        prompt={draftInstructions}
        onSave={handleSystemPromptSave}
        editable={editable}
      />
      {features.tools && (
        <ToolsDialog open={toolsOpen} onOpenChange={setToolsOpen} editable={editable} availableTools={availableTools} />
      )}
      {features.skills && <SkillsDialog open={skillsOpen} onOpenChange={setSkillsOpen} editable={editable} />}
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
    className="group flex items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-surface3"
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
      <Txt variant="ui-sm" className="shrink-0 tabular-nums text-neutral3">
        {count} / {total}
      </Txt>
    )}
    <ChevronRight className="h-4 w-4 shrink-0 text-neutral3 transition-colors group-hover:text-neutral5" />
  </button>
);

const AgentConfigurePanelSkeleton = () => (
  <div
    className="flex h-full flex-col border border-border1 bg-surface2 rounded-3xl overflow-hidden"
    data-testid="agent-configure-panel-skeleton"
  >
    <div className="flex-1 flex flex-col gap-6 py-6 overflow-y-auto">
      <div className="flex items-center gap-4 px-6">
        <Skeleton className="h-avatar-lg w-avatar-lg rounded-full shrink-0" />
        <div className="min-w-0 flex-1 flex flex-col gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
      <div className="flex flex-col divide-y divide-border1 border-t border-border1">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex items-center gap-3 px-6 py-4">
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const EditableAgentConfigurePanel = (props: AgentConfigurePanelProps) => {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const draftName = formMethods.watch('name');
  const draftDescription = formMethods.watch('description') ?? '';
  const draftInstructions = formMethods.watch('instructions') ?? '';

  const setDraftName = (value: string) => formMethods.setValue('name', value);
  const setDraftDescription = (value: string) => formMethods.setValue('description', value);
  const setDraftInstructions = (value: string) => formMethods.setValue('instructions', value);

  return (
    <AgentConfigurePanel
      {...props}
      editable={true}
      draftName={draftName}
      draftDescription={draftDescription}
      draftAvatarUrl={''}
      draftInstructions={draftInstructions}
      onDraftNameChange={setDraftName}
      onDraftDescriptionChange={setDraftDescription}
      onDraftAvatarUrlChange={() => {}}
      onDraftInstructionsChange={setDraftInstructions}
    />
  );
};

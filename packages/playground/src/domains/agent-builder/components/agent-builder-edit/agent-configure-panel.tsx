import type { StoredSkillResponse } from '@mastra/client-js';
import { isModelAllowed } from '@mastra/core/agent-builder/ee';
import { Avatar, cn, Skeleton, Switch, TextFieldBlock, toast, Txt } from '@mastra/playground-ui';
import { ChevronRight, FileText, Globe, LockIcon, Plus, Sparkles, TriangleAlertIcon, Wrench } from 'lucide-react';
import { useRef } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useBuilderAgentFeatures } from '../../hooks/use-builder-agent-features';
import type { AgentBuilderEditFormValues } from '../../schemas';
import type { AgentTool } from '../../types/agent-tool';
import { downscaleImageToDataUrl } from '../../utils/downscale-avatar';
import { InstructionsDetail } from './details/instructions-detail';
import { SkillsDetail } from './details/skills-detail';
import { ToolsDetail } from './details/tools-detail';
import { useBuilderModelPolicy } from '@/domains/builder';
import { LLMModels, LLMProviders, cleanProviderId } from '@/domains/llm';

export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  systemPrompt: string;
  visibility?: 'private' | 'public';
  authorId?: string | null;
  browserEnabled?: boolean;
}

export type ActiveDetail = 'instructions' | 'tools' | 'skills' | null;

interface BaseProps {
  availableAgentTools?: AgentTool[];
  availableSkills?: StoredSkillResponse[];
  isLoading?: boolean;
  activeDetail?: ActiveDetail;
  onActiveDetailChange?: (next: ActiveDetail) => void;
  disabled?: boolean;
}

type AgentConfigurePanelProps = BaseProps & {
  editable?: boolean;
  agent?: AgentConfig;
};

export function AgentConfigurePanel({
  availableAgentTools = [],
  availableSkills = [],
  isLoading = false,
  activeDetail = null,
  onActiveDetailChange = () => {},
  disabled = false,
  editable = true,
  agent,
}: AgentConfigurePanelProps) {
  if (isLoading) {
    return <AgentConfigurePanelSkeleton />;
  }

  return (
    <ConfigurePanelContent
      agent={agent}
      availableAgentTools={availableAgentTools}
      availableSkills={availableSkills}
      activeDetail={activeDetail}
      onActiveDetailChange={onActiveDetailChange}
      editable={editable}
      disabled={disabled}
    />
  );
}

interface ConfigurePanelContentProps {
  agent?: AgentConfig;
  availableAgentTools: AgentTool[];
  availableSkills: StoredSkillResponse[];
  activeDetail: ActiveDetail;
  onActiveDetailChange: (next: ActiveDetail) => void;
  editable: boolean;
  disabled?: boolean;
}

function ConfigurePanelContent({
  agent,
  availableAgentTools,
  availableSkills,
  activeDetail,
  onActiveDetailChange,
  editable,
  disabled = false,
}: ConfigurePanelContentProps) {
  const features = useBuilderAgentFeatures();
  const policy = useBuilderModelPolicy();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formMethods = useFormContext<AgentBuilderEditFormValues>();

  const draftName = formMethods.watch('name') ?? '';
  const draftDescription = formMethods.watch('description') ?? '';
  const draftInstructions = formMethods.watch('instructions') ?? '';
  const draftAvatarUrl = formMethods.watch('avatarUrl');

  const mutationsDisabled = disabled || !editable;
  const panelName = editable ? draftName : (agent?.name ?? draftName);
  const panelDescription = editable ? draftDescription : (agent?.description ?? draftDescription);
  const panelInstructions = editable ? draftInstructions : (agent?.systemPrompt ?? draftInstructions);
  const panelAvatarUrl = editable ? draftAvatarUrl : (agent?.avatarUrl ?? draftAvatarUrl);

  const setDraftName = (value: string) => {
    if (!mutationsDisabled) formMethods.setValue('name', value, { shouldDirty: true });
  };
  const setDraftDescription = (value: string) => {
    if (!mutationsDisabled) formMethods.setValue('description', value, { shouldDirty: true });
  };
  const setDraftInstructions = (value: string) => {
    if (!mutationsDisabled) formMethods.setValue('instructions', value, { shouldDirty: true });
  };

  const activeToolsCount = availableAgentTools.filter(item => item.isChecked).length;
  const totalToolsCount = availableAgentTools.length;

  const selectedSkills = useWatch({ control: formMethods.control, name: 'skills' }) ?? {};
  const activeSkillsCount = availableSkills.filter(skill => selectedSkills[skill.id]).length;
  const totalSkillsCount = availableSkills.length;

  const toggleDetail = (next: ActiveDetail) => {
    onActiveDetailChange(activeDetail === next ? null : next);
  };
  const closeDetail = () => onActiveDetailChange(null);

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || mutationsDisabled) return;

    try {
      const { dataUrl } = await downscaleImageToDataUrl(file);
      formMethods.setValue('avatarUrl', dataUrl, { shouldDirty: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process avatar image');
    }
  };

  const instructionsDescription = formatInstructionsPreview(panelInstructions);
  const modelSectionVisible = features.model || policy.active;

  return (
    <div className="relative h-full border border-border1 bg-surface2 rounded-3xl overflow-hidden">
      <div
        className={cn(
          'agent-builder-detail-pane absolute inset-y-0 right-[320px] overflow-hidden',
          activeDetail ? 'w-[calc(100%-320px)] border-r border-border1' : 'w-0 pointer-events-none',
        )}
        aria-hidden={!activeDetail}
      >
        <DetailPane
          activeDetail={activeDetail}
          features={features}
          editable={!mutationsDisabled}
          instructionsPrompt={panelInstructions}
          onInstructionsChange={setDraftInstructions}
          onClose={closeDetail}
          availableAgentTools={availableAgentTools}
          availableSkills={availableSkills}
        />
      </div>

      <div className="ml-auto w-[320px] flex h-full min-w-0 flex-col">
        <div className="flex-1 flex flex-col py-6 overflow-y-auto">
          <div className="flex flex-col gap-2 px-6 pb-6 border-b border-border1">
            <div className="flex items-center justify-center">
              {features.avatarUpload ? (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={mutationsDisabled}
                    className="group relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral3 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Upload avatar"
                    data-testid="agent-configure-avatar-trigger"
                  >
                    <Avatar src={panelAvatarUrl} name={panelName || 'A'} size="lg" interactive />
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
                </>
              ) : (
                <div data-testid="agent-configure-avatar-display">
                  <Avatar src={panelAvatarUrl} name={panelName || 'A'} size="lg" />
                </div>
              )}
            </div>

            <TextFieldBlock
              name="agent-name"
              label="Name"
              value={panelName}
              placeholder="Untitled agent"
              onChange={e => setDraftName(e.target.value)}
              disabled={mutationsDisabled}
              testId="agent-configure-name"
            />

            <TextFieldBlock
              name="agent-description"
              label="Description"
              value={panelDescription}
              placeholder="What is this agent for?"
              onChange={e => setDraftDescription(e.target.value)}
              disabled={mutationsDisabled}
              testId="agent-configure-description"
            />

            {modelSectionVisible && <ModelSection editable={!mutationsDisabled} />}
          </div>

          <ConfigRows
            features={features}
            instructionsDescription={instructionsDescription}
            activeToolsCount={activeToolsCount}
            totalToolsCount={totalToolsCount}
            activeSkillsCount={activeSkillsCount}
            totalSkillsCount={totalSkillsCount}
            activeDetail={activeDetail}
            toggleDetail={toggleDetail}
            disabled={mutationsDisabled}
          />
        </div>
      </div>
    </div>
  );
}

function formatInstructionsPreview(instructions: string): string {
  const trimmed = instructions.trim();
  if (trimmed.length === 0) return 'Set how your agent thinks and responds';
  if (trimmed.length > 80) return `${trimmed.slice(0, 80).trimEnd()}…`;
  return trimmed;
}

interface ModelSectionProps {
  editable: boolean;
}

function ModelSection({ editable }: ModelSectionProps) {
  const { setValue, watch } = useFormContext<AgentBuilderEditFormValues>();
  const policy = useBuilderModelPolicy();

  const model = watch('model');
  const provider = model?.provider ?? '';
  const modelId = model?.name ?? '';

  const locked = policy.active && policy.pickerVisible === false;
  const stale =
    Boolean(provider && modelId) &&
    policy.active &&
    policy.allowed !== undefined &&
    !isModelAllowed(policy.allowed, { provider: cleanProviderId(provider), modelId });

  const handleProviderSelect = (next: string) => {
    const cleaned = cleanProviderId(next);
    setValue('model', { provider: cleaned, name: '' }, { shouldDirty: true });
  };

  const handleModelSelect = (next: string) => {
    setValue('model', { provider: cleanProviderId(provider), name: next }, { shouldDirty: true });
  };

  return (
    <div className="flex flex-col gap-2">
      {locked ? (
        <LockedModelChip provider={policy.default?.provider ?? provider} modelId={policy.default?.modelId ?? modelId} />
      ) : (
        <div className="grid gap-2 text-neutral4 min-w-0" data-testid="model-detail-picker">
          <label className="text-ui-smd text-neutral3 flex justify-between items-center">Model</label>
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-1 basis-0 min-w-0">
              <LLMProviders
                value={provider}
                onValueChange={handleProviderSelect}
                disabled={!editable}
                className="w-full !min-w-0"
              />
            </div>
            <div className="flex-1 basis-0 min-w-0">
              <LLMModels
                llmId={provider}
                value={modelId}
                onValueChange={handleModelSelect}
                disabled={!editable}
                className="w-full !min-w-0"
              />
            </div>
          </div>
        </div>
      )}

      {stale && !locked && (
        <div
          className="flex items-start gap-2 rounded-md border border-accent6 bg-accent6Dark/40 px-3 py-2 text-accent6"
          data-testid="model-detail-stale-warning"
          role="alert"
        >
          <TriangleAlertIcon className="h-4 w-4 shrink-0 mt-0.5" />
          <Txt variant="ui-xs">
            <span className="font-medium">
              {provider}/{modelId}
            </span>{' '}
            is no longer allowed by the admin policy. Pick a different model to save changes.
          </Txt>
        </div>
      )}
    </div>
  );
}

interface ModelChipProps {
  provider: string;
  modelId: string;
}

const LockedModelChip = ({ provider, modelId }: ModelChipProps) => (
  <div
    className="flex items-center gap-2 rounded-md border border-border1 bg-surface3 px-3 py-2"
    data-testid="model-detail-locked-chip"
  >
    <LockIcon className="h-4 w-4 shrink-0 text-neutral3" />
    <Txt variant="ui-sm" className="font-medium text-neutral6 truncate">
      {provider && modelId ? `${provider}/${modelId}` : 'Locked by admin'}
    </Txt>
    <Txt variant="ui-xs" className="ml-auto shrink-0 text-neutral3">
      Set by admin
    </Txt>
  </div>
);

interface ConfigRowsProps {
  features: ReturnType<typeof useBuilderAgentFeatures>;
  instructionsDescription: string;
  activeToolsCount: number;
  totalToolsCount: number;
  activeSkillsCount: number;
  totalSkillsCount: number;
  activeDetail: ActiveDetail;
  toggleDetail: (next: ActiveDetail) => void;
  disabled?: boolean;
}

function BrowserToggleRow({ disabled = false }: { disabled?: boolean }) {
  const { setValue } = useFormContext<AgentBuilderEditFormValues>();
  const browserEnabled = useWatch<AgentBuilderEditFormValues, 'browserEnabled'>({ name: 'browserEnabled' });

  return (
    <div className={cn('flex items-center gap-3 px-6 py-4', disabled && 'cursor-not-allowed opacity-60')}>
      <span className="shrink-0 text-neutral3">
        <Globe className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Txt variant="ui-sm" className="font-medium text-neutral6">
          Browser
        </Txt>
        <Txt variant="ui-xs" className="truncate text-neutral3">
          Allow your agent to browse the web
        </Txt>
      </div>
      <Switch
        checked={browserEnabled ?? false}
        onCheckedChange={checked => setValue('browserEnabled', checked, { shouldDirty: true })}
        disabled={disabled}
        data-testid="agent-browser-toggle"
      />
    </div>
  );
}

function ConfigRows({
  features,
  instructionsDescription,
  activeToolsCount,
  totalToolsCount,
  activeSkillsCount,
  totalSkillsCount,
  activeDetail,
  toggleDetail,
  disabled = false,
}: ConfigRowsProps) {
  return (
    <div className="flex flex-col">
      <ConfigRow
        icon={<FileText className="h-4 w-4" />}
        label="Instructions"
        value={instructionsDescription}
        isActive={activeDetail === 'instructions'}
        onClick={() => toggleDetail('instructions')}
        disabled={disabled}
        testId="agent-preview-edit-system-prompt"
      />
      {features.tools && (
        <ConfigRow
          icon={<Wrench className="h-4 w-4" />}
          label="Tools"
          count={activeToolsCount}
          total={totalToolsCount}
          isActive={activeDetail === 'tools'}
          onClick={() => toggleDetail('tools')}
          disabled={disabled}
          testId="agent-preview-tools-button"
        />
      )}
      {features.skills && (
        <ConfigRow
          icon={<Sparkles className="h-4 w-4" />}
          label="Skills"
          count={activeSkillsCount}
          total={totalSkillsCount}
          isActive={activeDetail === 'skills'}
          onClick={() => toggleDetail('skills')}
          disabled={disabled}
          testId="agent-preview-skills-button"
        />
      )}
      {features.browser && <BrowserToggleRow disabled={disabled} />}
    </div>
  );
}

interface DetailPaneProps {
  activeDetail: ActiveDetail;
  features: ReturnType<typeof useBuilderAgentFeatures>;
  editable: boolean;
  instructionsPrompt: string;
  onInstructionsChange: (next: string) => void;
  onClose: () => void;
  availableAgentTools: AgentTool[];
  availableSkills: StoredSkillResponse[];
}

function DetailPane({
  activeDetail,
  features,
  editable,
  instructionsPrompt,
  onInstructionsChange,
  onClose,
  availableAgentTools,
  availableSkills,
}: DetailPaneProps) {
  return (
    <div className="h-full w-full min-w-0 overflow-hidden">
      {activeDetail === 'instructions' && (
        <InstructionsDetail
          prompt={instructionsPrompt}
          onChange={onInstructionsChange}
          onClose={onClose}
          editable={editable}
        />
      )}
      {activeDetail === 'tools' && features.tools && (
        <ToolsDetail onClose={onClose} editable={editable} availableAgentTools={availableAgentTools} />
      )}
      {activeDetail === 'skills' && features.skills && (
        <SkillsDetail onClose={onClose} editable={editable} availableSkills={availableSkills} />
      )}
    </div>
  );
}

interface ConfigRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  count?: number;
  total?: number;
  isActive?: boolean;
  onClick: () => void;
  testId: string;
  disabled?: boolean;
}

const ConfigRow = ({
  icon,
  label,
  value,
  count,
  total,
  isActive = false,
  onClick,
  testId,
  disabled = false,
}: ConfigRowProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    data-testid={testId}
    aria-pressed={isActive}
    className={cn(
      'group flex items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-surface3',
      isActive && 'bg-surface3',
      disabled && 'cursor-not-allowed opacity-60 hover:bg-transparent',
    )}
  >
    <span
      className={cn('shrink-0 text-neutral3 transition-colors group-hover:text-neutral5', isActive && 'text-neutral5')}
    >
      {icon}
    </span>
    <Txt variant="ui-sm" className="shrink-0 font-medium text-neutral6">
      {label}
    </Txt>
    {value !== undefined && (
      <Txt variant="ui-sm" className="ml-auto min-w-0 truncate text-neutral3">
        {value}
      </Txt>
    )}
    {count !== undefined && total !== undefined && (
      <Txt variant="ui-sm" className={cn('shrink-0 tabular-nums text-neutral3', value === undefined && 'ml-auto')}>
        {count} / {total}
      </Txt>
    )}
    <ChevronRight
      className={cn(
        'h-4 w-4 shrink-0 text-neutral3 transition-colors group-hover:text-neutral5',
        isActive && 'text-neutral5',
      )}
    />
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
      <div className="flex flex-col">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex items-center gap-3 px-6 py-4">
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
            <Skeleton className="h-4 w-20 shrink-0" />
            <Skeleton className="ml-auto h-4 w-24" />
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

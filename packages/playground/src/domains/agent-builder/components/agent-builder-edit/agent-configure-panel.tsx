import type { StoredSkillResponse } from '@mastra/client-js';
import { isModelAllowed } from '@mastra/core/agent-builder/ee';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionSummary,
  Avatar,
  Badge,
  cn,
  FieldBlock,
  Skeleton,
  Switch,
  Textarea,
  TextFieldBlock,
  toast,
  Txt,
} from '@mastra/playground-ui';
import { Check, Cpu, FileText, Globe, LockIcon, Plus, Sparkles, TriangleAlertIcon, Wrench } from 'lucide-react';
import { useRef } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useBuilderAgentFeatures } from '../../hooks/use-builder-agent-features';
import type { AgentBuilderEditFormValues } from '../../schemas';
import type { AgentTool } from '../../types/agent-tool';
import { downscaleImageToDataUrl } from '../../utils/downscale-avatar';
import { InstructionsDetail } from './details/instructions-detail';
import { SkillsDetail } from './details/skills-detail';
import { ToolsDetail } from './details/tools-detail';
import { ModelCardPicker } from './model-card-picker';
import { useStreamRunning } from './stream-chat-context';
import { useBuilderModelPolicy } from '@/domains/builder';
import { ProviderLogo, cleanProviderId } from '@/domains/llm';

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

interface BaseProps {
  availableAgentTools?: AgentTool[];
  availableSkills?: StoredSkillResponse[];
  isLoading?: boolean;
}

type AgentConfigurePanelProps = BaseProps & {
  editable?: boolean;
  agent?: AgentConfig;
  disabled?: boolean;
};

export function AgentConfigurePanel({
  availableAgentTools = [],
  availableSkills = [],
  isLoading = false,
  editable = true,
  agent,
  disabled,
}: AgentConfigurePanelProps) {
  const isRunning = useStreamRunning();

  if (isLoading) {
    return <AgentConfigurePanelSkeleton />;
  }

  return (
    <ConfigurePanelContent
      agent={agent}
      availableAgentTools={availableAgentTools}
      availableSkills={availableSkills}
      editable={editable}
      disabled={disabled ?? isRunning}
    />
  );
}

interface ConfigurePanelContentProps {
  agent?: AgentConfig;
  availableAgentTools: AgentTool[];
  availableSkills: StoredSkillResponse[];
  editable: boolean;
  disabled?: boolean;
}

function ConfigurePanelContent({
  agent,
  availableAgentTools,
  availableSkills,
  editable,
  disabled: propDisabled = false,
}: ConfigurePanelContentProps) {
  const features = useBuilderAgentFeatures();
  const policy = useBuilderModelPolicy();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formMethods = useFormContext<AgentBuilderEditFormValues>();

  const draftName = formMethods.watch('name') ?? '';
  const draftDescription = formMethods.watch('description') ?? '';
  const draftInstructions = formMethods.watch('instructions') ?? '';
  const draftAvatarUrl = formMethods.watch('avatarUrl');

  const disabled = propDisabled || !editable;
  const panelName = editable ? draftName : (agent?.name ?? draftName);
  const panelDescription = editable ? draftDescription : (agent?.description ?? draftDescription);
  const panelInstructions = editable ? draftInstructions : (agent?.systemPrompt ?? draftInstructions);
  const panelAvatarUrl = editable ? draftAvatarUrl : (agent?.avatarUrl ?? draftAvatarUrl);

  const setDraftName = (value: string) => {
    if (!disabled) formMethods.setValue('name', value, { shouldDirty: true });
  };
  const setDraftDescription = (value: string) => {
    if (!disabled) formMethods.setValue('description', value, { shouldDirty: true });
  };
  const setDraftInstructions = (value: string) => {
    if (!disabled) formMethods.setValue('instructions', value, { shouldDirty: true });
  };

  const activeToolsCount = availableAgentTools.filter(item => item.isChecked).length;
  const totalToolsCount = availableAgentTools.length;

  const selectedSkills = useWatch({ control: formMethods.control, name: 'skills' }) ?? {};
  const activeSkillsCount = availableSkills.filter(skill => selectedSkills[skill.id]).length;
  const totalSkillsCount = availableSkills.length;

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || disabled) return;

    try {
      const { dataUrl } = await downscaleImageToDataUrl(file);
      formMethods.setValue('avatarUrl', dataUrl, { shouldDirty: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process avatar image');
    }
  };

  const modelSectionVisible = features.model || policy.active;

  return (
    <div className="grid grid-rows-[auto_1fr] gap-4 border border-border1 bg-surface2 rounded-3xl p-6 h-full min-h-0">
      <div
        className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border1 bg-surface3 p-4"
        data-testid="agent-configure-header-card"
      >
        <div className="py-2 scale-150 origin-center">
          {features.avatarUpload ? (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral3 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Upload avatar"
                data-testid="agent-configure-avatar-trigger"
              >
                <Avatar src={panelAvatarUrl} name={panelName || 'A'} size="lg" interactive />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-surface4 opacity-0 transition-opacity">
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

        <div className="w-full space-y-2">
          <TextFieldBlock
            name="agent-name"
            label="Name"
            value={panelName}
            placeholder="Untitled agent"
            onChange={e => setDraftName(e.target.value)}
            disabled={disabled}
            testId="agent-configure-name"
          />

          <FieldBlock.Layout layout="vertical">
            <FieldBlock.Column>
              <FieldBlock.Label name="agent-description">Description</FieldBlock.Label>
              <Textarea
                name="agent-description"
                value={panelDescription}
                placeholder="What is this agent for?"
                onChange={e => setDraftDescription(e.target.value)}
                disabled={disabled}
                testId="agent-configure-description"
              />
            </FieldBlock.Column>
          </FieldBlock.Layout>
        </div>
      </div>

      <ConfigSections
        features={features}
        activeToolsCount={activeToolsCount}
        totalToolsCount={totalToolsCount}
        activeSkillsCount={activeSkillsCount}
        totalSkillsCount={totalSkillsCount}
        modelSectionVisible={modelSectionVisible}
        editable={!disabled}
        panelInstructions={panelInstructions}
        onInstructionsChange={setDraftInstructions}
        availableAgentTools={availableAgentTools}
        availableSkills={availableSkills}
        disabled={disabled}
      />
    </div>
  );
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

  return (
    <div className="grid h-full grid-rows-[1fr_auto] gap-4 p-4">
      {locked ? (
        <LockedModelChip provider={policy.default?.provider ?? provider} modelId={policy.default?.modelId ?? modelId} />
      ) : (
        <div className="grid grid-rows-1 gap-4 text-neutral4 min-w-0 pb-6" data-testid="model-detail-picker">
          <label className="sr-only">Model</label>
          <ModelCardPicker
            value={provider && modelId ? { provider, name: modelId } : undefined}
            onChange={next => setValue('model', next, { shouldDirty: true })}
            disabled={!editable}
          />
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

interface ConfigSectionsProps {
  features: ReturnType<typeof useBuilderAgentFeatures>;
  activeToolsCount: number;
  totalToolsCount: number;
  activeSkillsCount: number;
  totalSkillsCount: number;
  editable: boolean;
  panelInstructions: string;
  onInstructionsChange: (next: string) => void;
  availableAgentTools: AgentTool[];
  availableSkills: StoredSkillResponse[];
  disabled?: boolean;
  modelSectionVisible: boolean;
}

function BrowserSection({ disabled = false }: { disabled?: boolean }) {
  const { setValue } = useFormContext<AgentBuilderEditFormValues>();
  const browserEnabled = useWatch<AgentBuilderEditFormValues, 'browserEnabled'>({ name: 'browserEnabled' });

  return (
    <div className={cn('flex items-center gap-3', disabled && 'cursor-not-allowed opacity-60')}>
      <Txt variant="ui-sm" className="min-w-0 flex-1 text-neutral3">
        Allow your agent to browse the web
      </Txt>
      <Switch
        checked={browserEnabled ?? false}
        onCheckedChange={checked => setValue('browserEnabled', checked, { shouldDirty: true })}
        disabled={disabled}
        data-testid="agent-browser-toggle"
      />
    </div>
  );
}

function BrowserSummaryValue() {
  const browserEnabled = useWatch<AgentBuilderEditFormValues, 'browserEnabled'>({ name: 'browserEnabled' });
  return browserEnabled ? 'On' : 'Off';
}

function useModelFilled(): boolean {
  const policy = useBuilderModelPolicy();
  const model = useWatch<AgentBuilderEditFormValues, 'model'>({ name: 'model' });
  const locked = policy.active && policy.pickerVisible === false;
  const provider = locked ? (policy.default?.provider ?? model?.provider ?? '') : (model?.provider ?? '');
  const modelId = locked ? (policy.default?.modelId ?? model?.name ?? '') : (model?.name ?? '');
  return Boolean(provider && modelId);
}

function ConfigSections({
  features,
  activeToolsCount,
  totalToolsCount,
  activeSkillsCount,
  totalSkillsCount,
  editable,
  panelInstructions,
  onInstructionsChange,
  availableAgentTools,
  availableSkills,
  disabled = false,
  modelSectionVisible,
}: ConfigSectionsProps) {
  const modelFilled = useModelFilled();
  const browserEnabled = useWatch<AgentBuilderEditFormValues, 'browserEnabled'>({ name: 'browserEnabled' });
  const instructionsFilled = panelInstructions.trim().length > 0;

  return (
    <Accordion className="overflow-hidden bg-surface3 h-full min-h-0 rounded-xl border border-border1">
      {modelSectionVisible && (
        <ConfigSection
          value="model"
          icon={<Cpu className="h-4 w-4" />}
          label="Model"
          summaryValue={<ModelSummary />}
          filled={modelFilled}
          testId="agent-preview-model-button"
        >
          <ModelSection editable={editable} />
        </ConfigSection>
      )}
      <ConfigSection
        value="instructions"
        icon={<FileText className="h-4 w-4" />}
        label="Instructions"
        filled={instructionsFilled}
        testId="agent-preview-edit-system-prompt"
      >
        <InstructionsDetail prompt={panelInstructions} onChange={onInstructionsChange} editable={editable} />
      </ConfigSection>
      {features.tools && totalToolsCount > 0 && (
        <ConfigSection
          value="tools"
          icon={<Wrench className="h-4 w-4" />}
          label="Tools"
          count={activeToolsCount}
          total={totalToolsCount}
          filled={activeToolsCount > 0}
          testId="agent-preview-tools-button"
        >
          <ToolsDetail editable={editable} availableAgentTools={availableAgentTools} />
        </ConfigSection>
      )}
      {features.skills && totalSkillsCount > 0 && (
        <ConfigSection
          value="skills"
          icon={<Sparkles className="h-4 w-4" />}
          label="Skills"
          count={activeSkillsCount}
          total={totalSkillsCount}
          filled={activeSkillsCount > 0}
          testId="agent-preview-skills-button"
        >
          <SkillsDetail editable={editable} availableSkills={availableSkills} />
        </ConfigSection>
      )}
      {features.browser && (
        <ConfigSection
          value="browser"
          icon={<Globe className="h-4 w-4" />}
          label="Browser"
          summaryValue={<BrowserSummaryValue />}
          filled={Boolean(browserEnabled)}
          testId="agent-preview-browser-button"
        >
          <BrowserSection disabled={disabled} />
        </ConfigSection>
      )}
    </Accordion>
  );
}

function ModelSummary() {
  const policy = useBuilderModelPolicy();
  const model = useWatch<AgentBuilderEditFormValues, 'model'>({ name: 'model' });
  const locked = policy.active && policy.pickerVisible === false;
  const provider = locked ? (policy.default?.provider ?? model?.provider ?? '') : (model?.provider ?? '');
  const modelId = locked ? (policy.default?.modelId ?? model?.name ?? '') : (model?.name ?? '');
  if (!provider || !modelId) return <>Select a model</>;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 align-middle">
      <ProviderLogo providerId={provider} size={14} />
      <span className="truncate">
        {provider}/{modelId}
      </span>
    </span>
  );
}

interface ConfigSectionProps {
  value: string;
  icon: React.ReactNode;
  label: string;
  summaryValue?: React.ReactNode;
  count?: number;
  total?: number;
  filled?: boolean;
  testId: string;
  children: React.ReactNode;
}

const ConfigSection = ({
  value,
  icon,
  label,
  summaryValue,
  count,
  total,
  filled,
  testId,
  children,
}: ConfigSectionProps) => (
  <AccordionItem
    value={value}
    className={cn(
      'rounded-t-xl border border-border1 bg-surface3 overflow-hidden border-b-0 -mx-px first:-mt-px last:-mb-px -mt-2',
      'min-h-0 shrink-0',
      'data-[open]:flex-1 data-[open]:grid data-[open]:grid-rows-[auto_minmax(0,1fr)]',
    )}
  >
    <AccordionSummary data-testid={testId} className="px-4 shrink-0 pb-4">
      <div className="flex items-center gap-2">
        <span className="text-neutral3">{icon}</span>
        <Txt variant="ui-sm" className="font-medium text-neutral6">
          {label}
        </Txt>
      </div>

      {summaryValue !== undefined && (
        <Txt variant="ui-sm" className="ml-auto min-w-0 truncate text-neutral3">
          {summaryValue}
        </Txt>
      )}
      {count !== undefined && total !== undefined && (
        <Txt
          variant="ui-sm"
          className={cn('shrink-0 tabular-nums text-neutral3', summaryValue === undefined && 'ml-auto')}
        >
          {count} / {total}
        </Txt>
      )}
      {filled && (
        <Badge
          variant="success"
          size="sm"
          icon={<Check />}
          className={cn(summaryValue === undefined && count === undefined && 'ml-auto')}
        >
          <span data-testid={`${testId}-filled-badge`}>Set</span>
        </Badge>
      )}
    </AccordionSummary>

    <AccordionContent className="min-h-0 overflow-y-auto transition-none">{children}</AccordionContent>
  </AccordionItem>
);

const AgentConfigurePanelSkeleton = () => (
  <div
    className="flex h-full flex-col gap-4 border border-border1 bg-surface2 rounded-3xl overflow-hidden p-6"
    data-testid="agent-configure-panel-skeleton"
  >
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border1 bg-surface3 p-4">
      <Skeleton className="h-avatar-lg w-avatar-lg rounded-full shrink-0" />
      <div className="w-full space-y-2">
        <Skeleton className="h-9 w-full" />
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
);

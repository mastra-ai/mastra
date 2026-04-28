import type { StoredSkillResponse } from '@mastra/client-js';
import { Avatar, cn, Skeleton, TextFieldBlock, toast, Txt } from '@mastra/playground-ui';
import { ChevronRight, Cpu, FileText, Plus, Sparkles, Wrench } from 'lucide-react';
import { useRef } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useBuilderAgentFeatures } from '../../hooks/use-builder-agent-features';
import type { AgentBuilderEditFormValues } from '../../schemas';
import type { AgentTool } from '../../types/agent-tool';
import { downscaleImageToDataUrl } from '../../utils/downscale-avatar';
import { InstructionsDetail } from './details/instructions-detail';
import { ModelDetail } from './details/model-detail';
import { SkillsDetail } from './details/skills-detail';
import { ToolsDetail } from './details/tools-detail';
import { useBuilderModelPolicy } from '@/domains/builder';
import { VisibilityBadge } from '@/domains/shared/components/visibility-badge';

export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  systemPrompt: string;
  visibility?: 'private' | 'public';
  authorId?: string | null;
}

export type ActiveDetail = 'instructions' | 'model' | 'tools' | 'skills' | null;

interface BaseProps {
  availableAgentTools?: AgentTool[];
  availableSkills?: StoredSkillResponse[];
  isLoading?: boolean;
  activeDetail?: ActiveDetail;
  onActiveDetailChange?: (next: ActiveDetail) => void;
  disabled?: boolean;
}

type AgentConfigurePanelProps =
  | (BaseProps & { editable?: true; agent?: AgentConfig })
  | (BaseProps & { editable: false; agent: AgentConfig });

export function AgentConfigurePanel(props: AgentConfigurePanelProps) {
  const {
    availableAgentTools = [],
    availableSkills = [],
    isLoading = false,
    activeDetail = null,
    onActiveDetailChange = () => {},
    disabled = false,
  } = props;

  if (isLoading) {
    return <AgentConfigurePanelSkeleton />;
  }

  const editable = props.editable !== false;

  return editable ? (
    <EditableConfigurePanel
      availableAgentTools={availableAgentTools}
      availableSkills={availableSkills}
      activeDetail={activeDetail}
      onActiveDetailChange={onActiveDetailChange}
      disabled={disabled}
    />
  ) : (
    <ReadOnlyConfigurePanel
      agent={props.agent!}
      availableAgentTools={availableAgentTools}
      availableSkills={availableSkills}
      activeDetail={activeDetail}
      onActiveDetailChange={onActiveDetailChange}
    />
  );
}

interface ConfigurePanelContentProps {
  availableAgentTools: AgentTool[];
  availableSkills: StoredSkillResponse[];
  activeDetail: ActiveDetail;
  onActiveDetailChange: (next: ActiveDetail) => void;
}

interface EditableConfigurePanelProps extends ConfigurePanelContentProps {
  disabled?: boolean;
}

function EditableConfigurePanel({
  availableAgentTools,
  availableSkills,
  activeDetail,
  onActiveDetailChange,
  disabled = false,
}: EditableConfigurePanelProps) {
  const features = useBuilderAgentFeatures();
  const policy = useBuilderModelPolicy();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formMethods = useFormContext<AgentBuilderEditFormValues>();

  const draftName = formMethods.watch('name') ?? '';
  const draftDescription = formMethods.watch('description') ?? '';
  const draftInstructions = formMethods.watch('instructions') ?? '';
  const draftAvatarUrl = formMethods.watch('avatarUrl');
  const draftModel = useWatch({ control: formMethods.control, name: 'model' });

  const setDraftName = (value: string) => formMethods.setValue('name', value);
  const setDraftDescription = (value: string) => formMethods.setValue('description', value);
  const setDraftInstructions = (value: string) => formMethods.setValue('instructions', value);

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
    if (!file) return;

    try {
      const { dataUrl } = await downscaleImageToDataUrl(file);
      formMethods.setValue('avatarUrl', dataUrl, { shouldDirty: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process avatar image');
    }
  };

  const instructionsDescription = formatInstructionsPreview(draftInstructions);
  const modelRowVisible = features.model || policy.active;
  const modelDescription = formatModelDescription(draftModel, policy);

  return (
    <div
      className={cn(
        'grid h-full border border-border1 bg-surface2 rounded-3xl overflow-hidden agent-builder-detail-grid',
        activeDetail ? 'grid-cols-[320px_calc(100%-320px)]' : 'grid-cols-[320px_0px]',
      )}
    >
      <div className="flex h-full min-w-0 flex-col">
        <div className="flex-1 flex flex-col gap-6 py-6 overflow-y-auto">
          <div className="flex flex-col gap-3 px-6">
            <div className="flex items-center gap-4">
              {features.avatarUpload ? (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled}
                    className="group relative h-avatar-lg w-avatar-lg shrink-0 overflow-hidden rounded-full border border-border1 bg-surface3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral3 disabled:cursor-not-allowed disabled:opacity-60"
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
                </>
              ) : (
                <div
                  className="h-avatar-lg w-avatar-lg shrink-0 overflow-hidden rounded-full border border-border1 bg-surface3 flex items-center justify-center"
                  data-testid="agent-configure-avatar-display"
                >
                  {draftAvatarUrl ? (
                    <img src={draftAvatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-ui-md text-neutral4">
                      {(draftName[0] ?? 'A').toUpperCase()}
                    </span>
                  )}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <TextFieldBlock
                  name="agent-name"
                  label="Name"
                  value={draftName}
                  placeholder="Untitled agent"
                  onChange={e => setDraftName(e.target.value)}
                  disabled={disabled}
                  testId="agent-configure-name"
                />
              </div>
            </div>
            <TextFieldBlock
              name="agent-description"
              label="Description"
              value={draftDescription}
              placeholder="What is this agent for?"
              onChange={e => setDraftDescription(e.target.value)}
              disabled={disabled}
              testId="agent-configure-description"
            />
          </div>

          <ConfigRows
            features={features}
            instructionsDescription={instructionsDescription}
            modelRowVisible={modelRowVisible}
            modelDescription={modelDescription}
            activeToolsCount={activeToolsCount}
            totalToolsCount={totalToolsCount}
            activeSkillsCount={activeSkillsCount}
            totalSkillsCount={totalSkillsCount}
            activeDetail={activeDetail}
            toggleDetail={toggleDetail}
            disabled={disabled}
          />
        </div>
      </div>

      <DetailPane
        activeDetail={activeDetail}
        features={features}
        modelRowVisible={modelRowVisible}
        editable={!disabled}
        instructionsPrompt={draftInstructions}
        onInstructionsChange={setDraftInstructions}
        onClose={closeDetail}
        availableAgentTools={availableAgentTools}
        availableSkills={availableSkills}
      />
    </div>
  );
}

interface ReadOnlyConfigurePanelProps extends ConfigurePanelContentProps {
  agent: AgentConfig;
}

function ReadOnlyConfigurePanel({
  agent,
  availableAgentTools,
  availableSkills,
  activeDetail,
  onActiveDetailChange,
}: ReadOnlyConfigurePanelProps) {
  const features = useBuilderAgentFeatures();
  const policy = useBuilderModelPolicy();
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const draftModel = useWatch({ control: formMethods.control, name: 'model' });

  const activeToolsCount = availableAgentTools.filter(item => item.isChecked).length;
  const totalToolsCount = availableAgentTools.length;

  const selectedSkills = useWatch({ control: formMethods.control, name: 'skills' }) ?? {};
  const activeSkillsCount = availableSkills.filter(skill => selectedSkills[skill.id]).length;
  const totalSkillsCount = availableSkills.length;

  const toggleDetail = (next: ActiveDetail) => {
    onActiveDetailChange(activeDetail === next ? null : next);
  };
  const closeDetail = () => onActiveDetailChange(null);

  const instructionsDescription = formatInstructionsPreview(agent.systemPrompt);
  const modelRowVisible = features.model || policy.active;
  const modelDescription = formatModelDescription(draftModel, policy);

  return (
    <div
      className={cn(
        'grid h-full border border-border1 bg-surface2 rounded-3xl overflow-hidden agent-builder-detail-grid',
        activeDetail ? 'grid-cols-[320px_calc(100%-320px)]' : 'grid-cols-[320px_0px]',
      )}
    >
      <div className="flex h-full min-w-0 flex-col">
        <div className="flex-1 flex flex-col gap-6 py-6 overflow-y-auto">
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
            <VisibilityBadge visibility={agent.visibility} authorId={agent.authorId} />
          </div>

          <ConfigRows
            features={features}
            instructionsDescription={instructionsDescription}
            modelRowVisible={modelRowVisible}
            modelDescription={modelDescription}
            activeToolsCount={activeToolsCount}
            totalToolsCount={totalToolsCount}
            activeSkillsCount={activeSkillsCount}
            totalSkillsCount={totalSkillsCount}
            activeDetail={activeDetail}
            toggleDetail={toggleDetail}
          />
        </div>
      </div>

      <DetailPane
        activeDetail={activeDetail}
        features={features}
        modelRowVisible={modelRowVisible}
        editable={false}
        instructionsPrompt={agent.systemPrompt}
        onInstructionsChange={() => {}}
        onClose={closeDetail}
        availableAgentTools={availableAgentTools}
        availableSkills={availableSkills}
      />
    </div>
  );
}

function formatInstructionsPreview(instructions: string): string {
  const trimmed = instructions.trim();
  if (trimmed.length === 0) return 'Set how your agent thinks and responds';
  if (trimmed.length > 80) return `${trimmed.slice(0, 80).trimEnd()}…`;
  return trimmed;
}

function formatModelDescription(
  model: AgentBuilderEditFormValues['model'],
  policy: ReturnType<typeof useBuilderModelPolicy>,
): string {
  if (policy.active && policy.pickerVisible === false) {
    if (policy.default) return `Locked to ${policy.default.provider}/${policy.default.modelId}`;
    return 'Locked by admin';
  }
  if (model?.provider && model?.name) return `${model.provider}/${model.name}`;
  if (policy.active && policy.default) return `Default: ${policy.default.provider}/${policy.default.modelId}`;
  return 'Pick the model that powers this agent';
}

interface ConfigRowsProps {
  features: ReturnType<typeof useBuilderAgentFeatures>;
  instructionsDescription: string;
  modelRowVisible: boolean;
  modelDescription: string;
  activeToolsCount: number;
  totalToolsCount: number;
  activeSkillsCount: number;
  totalSkillsCount: number;
  activeDetail: ActiveDetail;
  toggleDetail: (next: ActiveDetail) => void;
  disabled?: boolean;
}

function ConfigRows({
  features,
  instructionsDescription,
  modelRowVisible,
  modelDescription,
  activeToolsCount,
  totalToolsCount,
  activeSkillsCount,
  totalSkillsCount,
  activeDetail,
  toggleDetail,
  disabled = false,
}: ConfigRowsProps) {
  return (
    <div className="flex flex-col divide-y divide-border1 border-t border-border1">
      <ConfigRow
        icon={<FileText className="h-4 w-4" />}
        label="Instructions"
        description={instructionsDescription}
        isActive={activeDetail === 'instructions'}
        onClick={() => toggleDetail('instructions')}
        disabled={disabled}
        testId="agent-preview-edit-system-prompt"
      />
      {modelRowVisible && (
        <ConfigRow
          icon={<Cpu className="h-4 w-4" />}
          label="Model"
          description={modelDescription}
          isActive={activeDetail === 'model'}
          onClick={() => toggleDetail('model')}
          disabled={disabled}
          testId="agent-preview-edit-model"
        />
      )}
      {features.tools && (
        <ConfigRow
          icon={<Wrench className="h-4 w-4" />}
          label="Tools"
          description="External actions your agent can take"
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
          description="Reusable capabilities your agent can use"
          count={activeSkillsCount}
          total={totalSkillsCount}
          isActive={activeDetail === 'skills'}
          onClick={() => toggleDetail('skills')}
          disabled={disabled}
          testId="agent-preview-skills-button"
        />
      )}
    </div>
  );
}

interface DetailPaneProps {
  activeDetail: ActiveDetail;
  features: ReturnType<typeof useBuilderAgentFeatures>;
  modelRowVisible: boolean;
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
  modelRowVisible,
  editable,
  instructionsPrompt,
  onInstructionsChange,
  onClose,
  availableAgentTools,
  availableSkills,
}: DetailPaneProps) {
  return (
    <div
      className={cn('h-full min-w-0 overflow-hidden', activeDetail ? 'border-l border-border1' : 'pointer-events-none')}
      aria-hidden={!activeDetail}
    >
      {activeDetail === 'instructions' && (
        <InstructionsDetail
          prompt={instructionsPrompt}
          onChange={onInstructionsChange}
          onClose={onClose}
          editable={editable}
        />
      )}
      {activeDetail === 'model' && modelRowVisible && <ModelDetail onClose={onClose} editable={editable} />}
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
  description: string;
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
  description,
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

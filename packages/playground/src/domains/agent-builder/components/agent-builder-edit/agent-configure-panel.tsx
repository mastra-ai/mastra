import { Avatar, cn, Skeleton, TextFieldBlock, toast, Txt } from '@mastra/playground-ui';
import { ChevronRight, FileText, Globe, Lock, Plus, Wrench } from 'lucide-react';
import { useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { useBuilderAgentFeatures } from '../../hooks/use-builder-agent-features';
import type { AgentBuilderEditFormValues } from '../../schemas';
import type { AgentTool } from '../../types/agent-tool';
import { downscaleImageToDataUrl } from '../../utils/downscale-avatar';
import { InstructionsDetail } from './details/instructions-detail';
import { ToolsDetail } from './details/tools-detail';
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

export type ActiveDetail = 'instructions' | 'tools' | null;

interface BaseProps {
  availableAgentTools?: AgentTool[];
  isLoading?: boolean;
  activeDetail?: ActiveDetail;
  onActiveDetailChange?: (next: ActiveDetail) => void;
}

type AgentConfigurePanelProps =
  | (BaseProps & { editable?: true; agent?: AgentConfig })
  | (BaseProps & { editable: false; agent: AgentConfig });

export function AgentConfigurePanel(props: AgentConfigurePanelProps) {
  const { availableAgentTools = [], isLoading = false, activeDetail = null, onActiveDetailChange = () => {} } = props;

  if (isLoading) {
    return <AgentConfigurePanelSkeleton />;
  }

  const editable = props.editable !== false;

  return editable ? (
    <EditableConfigurePanel
      availableAgentTools={availableAgentTools}
      activeDetail={activeDetail}
      onActiveDetailChange={onActiveDetailChange}
    />
  ) : (
    <ReadOnlyConfigurePanel
      agent={props.agent!}
      availableAgentTools={availableAgentTools}
      activeDetail={activeDetail}
      onActiveDetailChange={onActiveDetailChange}
    />
  );
}

interface ConfigurePanelContentProps {
  availableAgentTools: AgentTool[];
  activeDetail: ActiveDetail;
  onActiveDetailChange: (next: ActiveDetail) => void;
}

function EditableConfigurePanel({
  availableAgentTools,
  activeDetail,
  onActiveDetailChange,
}: ConfigurePanelContentProps) {
  const features = useBuilderAgentFeatures();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formMethods = useFormContext<AgentBuilderEditFormValues>();

  const draftName = formMethods.watch('name') ?? '';
  const draftDescription = formMethods.watch('description') ?? '';
  const draftInstructions = formMethods.watch('instructions') ?? '';
  const draftVisibility = formMethods.watch('visibility') ?? 'private';
  const draftAvatarUrl = formMethods.watch('avatarUrl');

  const setDraftName = (value: string) => formMethods.setValue('name', value);
  const setDraftDescription = (value: string) => formMethods.setValue('description', value);
  const setDraftInstructions = (value: string) => formMethods.setValue('instructions', value);

  const activeToolsCount = availableAgentTools.filter(item => item.isChecked).length;
  const totalToolsCount = availableAgentTools.length;

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
              testId="agent-configure-description"
            />

            <VisibilitySegmentedControl
              value={draftVisibility}
              onChange={next => formMethods.setValue('visibility', next)}
            />
          </div>

          <ConfigRows
            features={features}
            instructionsDescription={instructionsDescription}
            activeToolsCount={activeToolsCount}
            totalToolsCount={totalToolsCount}
            activeDetail={activeDetail}
            toggleDetail={toggleDetail}
          />
        </div>
      </div>

      <DetailPane
        activeDetail={activeDetail}
        features={features}
        editable
        instructionsPrompt={draftInstructions}
        onInstructionsChange={setDraftInstructions}
        onClose={closeDetail}
        availableAgentTools={availableAgentTools}
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
  activeDetail,
  onActiveDetailChange,
}: ReadOnlyConfigurePanelProps) {
  const features = useBuilderAgentFeatures();

  const activeToolsCount = availableAgentTools.filter(item => item.isChecked).length;
  const totalToolsCount = availableAgentTools.length;

  const toggleDetail = (next: ActiveDetail) => {
    onActiveDetailChange(activeDetail === next ? null : next);
  };
  const closeDetail = () => onActiveDetailChange(null);

  const instructionsDescription = formatInstructionsPreview(agent.systemPrompt);

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
            activeToolsCount={activeToolsCount}
            totalToolsCount={totalToolsCount}
            activeDetail={activeDetail}
            toggleDetail={toggleDetail}
          />
        </div>
      </div>

      <DetailPane
        activeDetail={activeDetail}
        features={features}
        editable={false}
        instructionsPrompt={agent.systemPrompt}
        onInstructionsChange={() => {}}
        onClose={closeDetail}
        availableAgentTools={availableAgentTools}
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

interface ConfigRowsProps {
  features: ReturnType<typeof useBuilderAgentFeatures>;
  instructionsDescription: string;
  activeToolsCount: number;
  totalToolsCount: number;
  activeDetail: ActiveDetail;
  toggleDetail: (next: ActiveDetail) => void;
}

function ConfigRows({
  features,
  instructionsDescription,
  activeToolsCount,
  totalToolsCount,
  activeDetail,
  toggleDetail,
}: ConfigRowsProps) {
  return (
    <div className="flex flex-col divide-y divide-border1 border-t border-border1">
      <ConfigRow
        icon={<FileText className="h-4 w-4" />}
        label="Instructions"
        description={instructionsDescription}
        isActive={activeDetail === 'instructions'}
        onClick={() => toggleDetail('instructions')}
        testId="agent-preview-edit-system-prompt"
      />
      {features.tools && (
        <ConfigRow
          icon={<Wrench className="h-4 w-4" />}
          label="Tools"
          description="External actions your agent can take"
          count={activeToolsCount}
          total={totalToolsCount}
          isActive={activeDetail === 'tools'}
          onClick={() => toggleDetail('tools')}
          testId="agent-preview-tools-button"
        />
      )}
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
}

function DetailPane({
  activeDetail,
  features,
  editable,
  instructionsPrompt,
  onInstructionsChange,
  onClose,
  availableAgentTools,
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
      {activeDetail === 'tools' && features.tools && (
        <ToolsDetail onClose={onClose} editable={editable} availableAgentTools={availableAgentTools} />
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
}

const ConfigRow = ({ icon, label, description, count, total, isActive = false, onClick, testId }: ConfigRowProps) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId}
    aria-pressed={isActive}
    className={cn(
      'group flex items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-surface3',
      isActive && 'bg-surface3',
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

function VisibilitySegmentedControl({
  value,
  onChange,
}: {
  value: 'private' | 'public';
  onChange: (next: 'private' | 'public') => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Txt as="label" variant="ui-xs" className="text-neutral3">
        Visibility
      </Txt>
      <div className="inline-flex rounded-lg border border-border1 bg-surface1 p-0.5" data-testid="visibility-toggle">
        <button
          type="button"
          onClick={() => onChange('private')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-ui-xs font-medium transition-colors',
            value === 'private' ? 'bg-surface3 text-neutral6 shadow-sm' : 'text-neutral3 hover:text-neutral5',
          )}
          data-testid="visibility-toggle-private"
        >
          <Lock className="h-3 w-3" />
          Private
        </button>
        <button
          type="button"
          onClick={() => onChange('public')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-ui-xs font-medium transition-colors',
            value === 'public' ? 'bg-surface3 text-neutral6 shadow-sm' : 'text-neutral3 hover:text-neutral5',
          )}
          data-testid="visibility-toggle-public"
        >
          <Globe className="h-3 w-3" />
          Public
        </button>
      </div>
    </div>
  );
}

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

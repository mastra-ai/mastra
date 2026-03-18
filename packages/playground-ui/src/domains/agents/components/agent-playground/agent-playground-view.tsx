import { useState } from 'react';
import { Panel, Group, useDefaultLayout } from 'react-resizable-panels';
import { FlaskConical, MessageSquare, ClipboardCheck } from 'lucide-react';

import { PanelSeparator } from '@/lib/resize/separator';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/lib/utils';

import { PlaygroundModelProvider } from '../../context/playground-model-context';
import { ReviewQueueProvider, useReviewQueue } from '../../context/review-queue-context';
import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { cleanProviderId } from '@/domains/llm';
import { AgentPlaygroundConfig } from './agent-playground-config';
import { AgentPlaygroundTestChat } from './agent-playground-test-chat';
import { AgentPlaygroundVersionBar } from './agent-playground-version-bar';
import { AgentPlaygroundEvaluate } from './agent-playground-evaluate';
import { AgentPlaygroundReview } from './agent-playground-review';
import { PlaygroundModelSelector } from './playground-model-selector';

type RightPanelTab = 'chat' | 'evaluate' | 'review';

interface AgentPlaygroundViewProps {
  agentId: string;
  agentName?: string;
  modelVersion?: string;
  hasMemory: boolean;
  activeVersionId?: string;
  selectedVersionId?: string;
  latestVersionId?: string;
  requestContextSchema?: string;
  onVersionSelect: (versionId: string) => void;
  isDirty: boolean;
  isSavingDraft: boolean;
  isPublishing: boolean;
  hasDraft: boolean;
  readOnly: boolean;
  onSaveDraft: (changeMessage?: string) => Promise<void>;
  onPublish: () => Promise<void>;
}

function LeftPanel({
  agentId,
  activeVersionId,
  selectedVersionId,
  latestVersionId,
  onVersionSelect,
  isDirty,
  isSavingDraft,
  isPublishing,
  hasDraft,
  readOnly,
  onSaveDraft,
  onPublish,
}: {
  agentId: string;
  activeVersionId?: string;
  selectedVersionId?: string;
  latestVersionId?: string;
  onVersionSelect: (versionId: string) => void;
  isDirty: boolean;
  isSavingDraft: boolean;
  isPublishing: boolean;
  hasDraft: boolean;
  readOnly: boolean;
  onSaveDraft: (changeMessage?: string) => Promise<void>;
  onPublish: () => Promise<void>;
}) {
  const { versionSelector, actionBar } = AgentPlaygroundVersionBar({
    agentId,
    activeVersionId,
    selectedVersionId,
    onVersionSelect,
    isDirty,
    isSavingDraft,
    isPublishing,
    hasDraft,
    readOnly,
    onSaveDraft,
    onPublish,
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {versionSelector}

      <div className="px-4 pt-3">
        <Txt variant="ui-sm" className="text-neutral3">
          Edit your agent's system prompt, tools, and variables below.
        </Txt>
      </div>

      <div className="flex-1 min-h-0">
        <AgentPlaygroundConfig
          agentId={agentId}
          selectedVersionId={selectedVersionId}
          latestVersionId={latestVersionId}
        />
      </div>

      {actionBar}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2 text-sm transition-colors border-b-2',
        active ? 'border-white/50 text-neutral5' : 'border-transparent text-neutral3 hover:text-neutral5',
      )}
    >
      <Icon size="sm">{icon}</Icon>
      <Txt variant="ui-sm" className="text-inherit">
        {label}
      </Txt>
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 bg-accent1 text-white text-xs font-medium rounded-full px-1.5 py-0 min-w-[18px] text-center leading-[18px]">
          {badge}
        </span>
      )}
    </button>
  );
}

function ReviewTabButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const { items } = useReviewQueue();
  return <TabButton active={active} onClick={onClick} icon={<ClipboardCheck />} label="Review" badge={items.length} />;
}

export function AgentPlaygroundView({
  agentId,
  agentName,
  modelVersion,
  hasMemory,
  activeVersionId,
  selectedVersionId,
  latestVersionId,
  requestContextSchema,
  onVersionSelect,
  isDirty,
  isSavingDraft,
  isPublishing,
  hasDraft,
  readOnly,
  onSaveDraft,
  onPublish,
}: AgentPlaygroundViewProps) {
  const [rightTab, setRightTab] = useState<RightPanelTab>(() => {
    const stored = sessionStorage.getItem(`playground-tab-${agentId}`);
    return (stored === 'evaluate' || stored === 'review') ? stored : 'chat';
  });
  const [pendingScorerItems, setPendingScorerItems] = useState<Array<{ input: unknown; output: unknown }> | null>(null);
  const handleSetRightTab = (tab: RightPanelTab) => {
    sessionStorage.setItem(`playground-tab-${agentId}`, tab);
    setRightTab(tab);
  };
  const handleCreateScorerFromReview = (items: Array<{ input: unknown; output: unknown }>) => {
    setPendingScorerItems(items);
    handleSetRightTab('evaluate');
  };
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `agent-playground-${agentId}`,
    storage: localStorage,
  });
  const { form } = useAgentEditFormContext();
  const defaultProvider = cleanProviderId(form.getValues('model.provider') || '');
  const defaultModel = form.getValues('model.name') || '';

  return (
    <PlaygroundModelProvider defaultProvider={defaultProvider} defaultModel={defaultModel}>
    <ReviewQueueProvider>
      <div className="flex flex-col h-full overflow-hidden bg-surface2">
        <Group className="flex-1 min-h-0" defaultLayout={defaultLayout} onLayoutChange={onLayoutChange}>
        {/* Left panel - Version Bar + Configuration + Action Bar */}
        <Panel id="playground-config" minSize={30} defaultSize={50} className="overflow-hidden">
          <LeftPanel
            agentId={agentId}
            activeVersionId={activeVersionId}
            selectedVersionId={selectedVersionId}
            latestVersionId={latestVersionId}
            onVersionSelect={onVersionSelect}
            isDirty={isDirty}
            isSavingDraft={isSavingDraft}
            isPublishing={isPublishing}
            hasDraft={hasDraft}
            readOnly={readOnly}
            onSaveDraft={onSaveDraft}
            onPublish={onPublish}
          />
        </Panel>

        <PanelSeparator />

        {/* Right panel - Chat / Evaluate / Review */}
        <Panel id="playground-eval" minSize={30} defaultSize={50} className="overflow-hidden">
          <div className="flex flex-col h-full overflow-hidden bg-surface1">
            <div className="flex items-center border-b border-border1 px-2">
              <TabButton
                active={rightTab === 'chat'}
                onClick={() => handleSetRightTab('chat')}
                icon={<MessageSquare />}
                label="Chat"
              />
              <TabButton
                active={rightTab === 'evaluate'}
                onClick={() => handleSetRightTab('evaluate')}
                icon={<FlaskConical />}
                label="Evaluate"
              />
              <ReviewTabButton active={rightTab === 'review'} onClick={() => handleSetRightTab('review')} />
              <div className="ml-auto">
                <PlaygroundModelSelector />
              </div>
            </div>

            <div className="flex-1 min-h-0">
              {rightTab === 'chat' ? (
                <AgentPlaygroundTestChat
                  agentId={agentId}
                  agentName={agentName}
                  modelVersion={modelVersion}
                  hasMemory={hasMemory}
                  requestContextSchema={requestContextSchema}
                />
              ) : rightTab === 'evaluate' ? (
                <AgentPlaygroundEvaluate
                  agentId={agentId}
                  onSwitchToReview={() => handleSetRightTab('review')}
                  pendingScorerItems={pendingScorerItems}
                  onPendingScorerItemsConsumed={() => setPendingScorerItems(null)}
                />
              ) : (
                <AgentPlaygroundReview agentId={agentId} onCreateScorer={handleCreateScorerFromReview} />
              )}
            </div>
          </div>
        </Panel>
      </Group>
    </div>
    </ReviewQueueProvider>
    </PlaygroundModelProvider>
  );
}

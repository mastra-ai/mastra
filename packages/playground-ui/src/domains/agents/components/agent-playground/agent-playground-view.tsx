import { useState } from 'react';
import { Panel, Group, useDefaultLayout } from 'react-resizable-panels';
import { FlaskConical, MessageSquare, Braces } from 'lucide-react';

import { PanelSeparator } from '@/lib/resize/separator';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/lib/utils';

import { AgentPlaygroundConfig } from './agent-playground-config';
import { AgentPlaygroundEval } from './agent-playground-eval';
import { AgentPlaygroundTestChat } from './agent-playground-test-chat';
import { AgentPlaygroundVersionBar } from './agent-playground-version-bar';
import { AgentPlaygroundRequestContext } from './agent-playground-request-context';

type RightPanelTab = 'experiment' | 'test-chat' | 'request-context';

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
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
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
    </button>
  );
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
  const [rightTab, setRightTab] = useState<RightPanelTab>('experiment');
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `agent-playground-${agentId}`,
    storage: localStorage,
  });

  return (
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

        {/* Right panel - Experiment / Test Chat / Request Context */}
        <Panel id="playground-eval" minSize={30} defaultSize={50} className="overflow-hidden">
          <div className="flex flex-col h-full overflow-hidden bg-surface1">
            <div className="flex items-center border-b border-border1 px-2">
              <TabButton
                active={rightTab === 'experiment'}
                onClick={() => setRightTab('experiment')}
                icon={<FlaskConical />}
                label="Experiment"
              />
              <TabButton
                active={rightTab === 'test-chat'}
                onClick={() => setRightTab('test-chat')}
                icon={<MessageSquare />}
                label="Test Chat"
              />
              <div className="ml-auto">
                <TabButton
                  active={rightTab === 'request-context'}
                  onClick={() => setRightTab('request-context')}
                  icon={<Braces />}
                  label="Request Context"
                />
              </div>
            </div>

            <div className="flex-1 min-h-0">
              {rightTab === 'experiment' ? (
                <AgentPlaygroundEval agentId={agentId} onSaveDraft={onSaveDraft} />
              ) : rightTab === 'test-chat' ? (
                <AgentPlaygroundTestChat
                  agentId={agentId}
                  agentName={agentName}
                  modelVersion={modelVersion}
                  hasMemory={hasMemory}
                />
              ) : (
                <AgentPlaygroundRequestContext requestContextSchema={requestContextSchema} />
              )}
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}

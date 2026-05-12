import { Txt, PanelSeparator, CollapsiblePanel } from '@mastra/playground-ui';
import { Group, useDefaultLayout } from 'react-resizable-panels';

import { AgentPlaygroundConfig } from './agent-playground-config';
import { AgentPlaygroundTestChat } from './agent-playground-test-chat';
import { AgentPlaygroundVersionBar } from './agent-playground-version-bar';

interface AgentPlaygroundViewProps {
  agentId: string;
  agentName?: string;
  modelVersion?: string;
  agentVersionId?: string;
  hasMemory: boolean;
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
  isViewingPreviousVersion?: boolean;
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
  isViewingPreviousVersion,
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
  isViewingPreviousVersion?: boolean;
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
    isViewingPreviousVersion,
  });

  return (
    <div className="h-full w-full py-2 pl-2">
      <div className="flex flex-col h-full overflow-hidden bg-surface2 rounded-3xl border border-border2/40">
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
    </div>
  );
}

export function AgentPlaygroundView({
  agentId,
  agentName,
  modelVersion,
  agentVersionId,
  hasMemory,
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
  isViewingPreviousVersion,
}: AgentPlaygroundViewProps) {
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `agent-playground-${agentId}`,
    storage: localStorage,
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Group className="flex-1 min-h-0" defaultLayout={defaultLayout} onLayoutChange={onLayoutChange}>
        {/* Left panel - Version Bar + Configuration + Action Bar */}
        <CollapsiblePanel
          direction="left"
          id="playground-config"
          minSize={420}
          defaultSize="50%"
          collapsedSize={80}
          collapsible
          className="overflow-hidden"
        >
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
            isViewingPreviousVersion={isViewingPreviousVersion}
          />
        </CollapsiblePanel>

        <PanelSeparator />

        {/* Right panel - Test Chat */}
        <CollapsiblePanel
          direction="right"
          id="playground-chat"
          minSize={420}
          defaultSize="50%"
          collapsedSize={80}
          collapsible
          className="overflow-hidden"
        >
          <div className="flex flex-col h-full overflow-hidden bg-surface1">
            <div className="flex-1 min-h-0">
              <AgentPlaygroundTestChat
                agentId={agentId}
                agentName={agentName}
                modelVersion={modelVersion}
                agentVersionId={agentVersionId}
                hasMemory={hasMemory}
              />
            </div>
          </div>
        </CollapsiblePanel>
      </Group>
    </div>
  );
}

import { Txt, PanelSeparator, CollapsiblePanel, PanelDrawer, useIsMobile } from '@mastra/playground-ui';
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
  isCodeSourceAgent?: boolean;
  showCodeModeActions?: boolean;
  canOpenPr?: boolean;
  openPrTitle?: string;
  onSaveDraft: (changeMessage?: string) => Promise<void>;
  onPublish: () => Promise<void>;
  onDownloadJson?: () => Promise<void>;
  onOpenPr?: () => Promise<void>;
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
  isCodeSourceAgent,
  showCodeModeActions,
  canOpenPr,
  openPrTitle,
  onSaveDraft,
  onPublish,
  onDownloadJson,
  onOpenPr,
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
  isCodeSourceAgent?: boolean;
  showCodeModeActions?: boolean;
  canOpenPr?: boolean;
  openPrTitle?: string;
  onSaveDraft: (changeMessage?: string) => Promise<void>;
  onPublish: () => Promise<void>;
  onDownloadJson?: () => Promise<void>;
  onOpenPr?: () => Promise<void>;
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
    isCodeSourceAgent,
    showCodeModeActions,
    canOpenPr,
    openPrTitle,
    onSaveDraft,
    onPublish,
    onDownloadJson,
    onOpenPr,
    isViewingPreviousVersion,
  });

  return (
    <div className="h-full w-full pb-2 pl-2">
      <div className="flex flex-col h-full overflow-hidden bg-surface3 rounded-studio-panel border border-border1">
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
  isCodeSourceAgent,
  showCodeModeActions,
  canOpenPr,
  openPrTitle,
  onSaveDraft,
  onPublish,
  onDownloadJson,
  onOpenPr,
  isViewingPreviousVersion,
}: AgentPlaygroundViewProps) {
  const isMobile = useIsMobile();
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `agent-playground`,
    storage: localStorage,
  });

  // Side-by-side resizable panels don't fit small viewports: the chat takes
  // the full width and the configuration moves into an edge drawer.
  if (isMobile) {
    return (
      <div className="relative flex h-full flex-col overflow-hidden">
        <div className="min-h-0 flex-1">
          <AgentPlaygroundTestChat
            agentId={agentId}
            agentName={agentName}
            modelVersion={modelVersion}
            agentVersionId={agentVersionId}
            hasMemory={hasMemory}
          />
        </div>
        <PanelDrawer direction="left" label="Open configuration">
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
            isCodeSourceAgent={isCodeSourceAgent}
            showCodeModeActions={showCodeModeActions}
            canOpenPr={canOpenPr}
            openPrTitle={openPrTitle}
            onSaveDraft={onSaveDraft}
            onPublish={onPublish}
            onDownloadJson={onDownloadJson}
            onOpenPr={onOpenPr}
            isViewingPreviousVersion={isViewingPreviousVersion}
          />
        </PanelDrawer>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Group className="flex-1 min-h-0" defaultLayout={defaultLayout} onLayoutChange={onLayoutChange}>
        {/* Left panel - Version Bar + Configuration + Action Bar */}
        <CollapsiblePanel
          direction="left"
          id="playground-config"
          minSize={420}
          defaultSize="50%"
          collapsedSize={0}
          collapsible
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
            isCodeSourceAgent={isCodeSourceAgent}
            showCodeModeActions={showCodeModeActions}
            canOpenPr={canOpenPr}
            openPrTitle={openPrTitle}
            onSaveDraft={onSaveDraft}
            onPublish={onPublish}
            onDownloadJson={onDownloadJson}
            onOpenPr={onOpenPr}
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
          collapsedSize={0}
          collapsible
        >
          <div className="flex flex-col h-full overflow-hidden">
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

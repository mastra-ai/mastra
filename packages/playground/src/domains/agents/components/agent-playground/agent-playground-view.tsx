import { Txt } from '@mastra/playground-ui/components/Txt';

import { AgentLayout } from '../agent-layout';
import { SidebarPanel } from '../sidebar-panel';
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
    <SidebarPanel>
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
    </SidebarPanel>
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
  return (
    <AgentLayout
      agentId={agentId}
      leftDrawerLabel="Open configuration"
      leftSlot={
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
      }
    >
      <AgentPlaygroundTestChat
        agentId={agentId}
        agentName={agentName}
        modelVersion={modelVersion}
        agentVersionId={agentVersionId}
        hasMemory={hasMemory}
      />
    </AgentLayout>
  );
}
